/* U12 备课助手 runtime for the hosted site.
 * The page was built for the claude.ai Artifact runtime (window.claude.use("sample" | "db" | "user")).
 * This file gives it the same interface on Supabase (login + "docs" table) and /api/sample (DeepSeek),
 * so the page logic stays unchanged. Loaded as a classic script before the page script. */
(function (root) {
  "use strict";
  const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

  const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const hasUndefined = (v) => v === undefined || (!!v && typeof v === "object" && Object.values(v).some(hasUndefined));
  const refuseUndefined = (data) => { if (hasUndefined(data)) throw { code: "invalid_argument", message: "数据里有 undefined 字段" }; };
  const dbError = (error, what) => ({ code: error.code || "db_error", message: `${what}（${error.message}）` });
  const newId = () => {
    const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => abc[b % 36]).join("");
  };

  /** "data/users/<uid>/<rest>" → "<rest>" ("" for the root collection). Other users' paths are a programming error. */
  function collPath(path, uid) {
    const base = `data/users/${uid}`;
    if (path === base) return "";
    if (path.startsWith(base + "/")) return path.slice(base.length + 1);
    throw new Error(`unknown collection path: ${path}`);
  }

  /** Firestore-like collections over the "docs" table, with the Artifact database's rules (frozen reads, no undefined, update needs an existing doc). */
  function makeDb(client, uid) {
    const table = () => client.from("docs");
    const now = () => new Date().toISOString();
    const snap = (rows) => ({ empty: rows.length === 0, docs: rows.map((r) => ({ id: r.id, data: () => deepFreeze(JSON.parse(JSON.stringify(r.data))) })) });
    const query = (coll, steps) => ({
      where: (field, op, value) => {
        if (op !== "==") throw new Error(`where: only "==" is supported, got ${op}`);
        return query(coll, [...steps, (q) => q.eq(`data->>${field}`, String(value))]);
      },
      orderBy: (field, dir = "asc") => query(coll, [...steps, (q) => q.order(`data->>${field}`, { ascending: dir !== "desc" })]),
      limit: (n) => query(coll, [...steps, (q) => q.limit(n)]),
      get: async () => {
        let q = table().select("id,data").eq("owner", uid).eq("coll", coll);
        for (const step of steps) q = step(q);
        const { data, error } = await q;
        if (error) throw dbError(error, "读取失败");
        return snap(data);
      },
      add: async (data) => {
        refuseUndefined(data);
        const id = newId();
        const { error } = await table().insert({ owner: uid, coll, id, data, updated_at: now() });
        if (error) throw dbError(error, "保存失败");
        return { id };
      },
      doc: (id) => {
        const one = async () => {
          const { data, error } = await table().select("id,data").eq("owner", uid).eq("coll", coll).eq("id", id).maybeSingle();
          if (error) throw dbError(error, "读取失败");
          return data;
        };
        return {
          id,
          get: async () => { const row = await one(); return { id, exists: !!row, data: () => (row ? deepFreeze(JSON.parse(JSON.stringify(row.data))) : undefined) }; },
          set: async (data) => {
            refuseUndefined(data);
            const { error } = await table().upsert({ owner: uid, coll, id, data, updated_at: now() });
            if (error) throw dbError(error, "保存失败");
          },
          update: async (patch) => {
            refuseUndefined(patch);
            const row = await one();
            if (!row) throw { code: "not_found", message: `没有这条记录：${id}` };
            // ponytail: read-merge-write, last writer wins per doc; the page writes one doc at a time
            const { error } = await table().update({ data: { ...row.data, ...patch }, updated_at: now() }).eq("owner", uid).eq("coll", coll).eq("id", id);
            if (error) throw dbError(error, "保存失败");
          },
          delete: async () => {
            const { error } = await table().delete().eq("owner", uid).eq("coll", coll).eq("id", id);
            if (error) throw dbError(error, "删除失败");
          },
        };
      },
    });
    return { collection: (path) => query(collPath(path, uid), []) };
  }

  /** sample.json(prompt, {signal, onText}) over POST /api/sample (NDJSON page events, see lib/deepseek.ts). */
  function makeSample(fetchFn, getToken, onUnauthorized) {
    const cancelled = { code: "cancelled", message: "已停止" };
    const isAbort = (e) => !!e && e.name === "AbortError";
    return {
      json: async (prompt, opts = {}) => {
        let res;
        try {
          res = await fetchFn("/api/sample", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${await getToken()}` },
            body: JSON.stringify({ prompt }),
            signal: opts.signal,
          });
        } catch (e) {
          if (isAbort(e)) throw cancelled;
          throw { code: "upstream_error", message: `连不上服务器（${e && e.message}）` };
        }
        if (res.status === 401) { onUnauthorized(); throw { code: "not_granted", message: "登录已过期，请重新登录" }; }
        if (!res.ok) {
          let body = {};
          try { body = await res.json(); } catch (e) { console.warn("error body is not JSON", e); }
          throw { code: body.code || "upstream_error", message: body.message || `服务器错误 ${res.status}` };
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "", text = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              let ev;
              try { ev = JSON.parse(line); } catch (e) { throw { code: "upstream_error", message: `服务器回复格式不对（${e.message}）` }; }
              if (ev.type === "progress") { text += ev.delta; if (opts.onText) opts.onText({ text }); }
              else if (ev.type === "result") return deepFreeze(ev.data);
              else if (ev.type === "error") throw { code: ev.code, message: ev.message };
            }
          }
        } catch (e) {
          if (isAbort(e)) throw cancelled;
          throw e;
        }
        throw { code: "upstream_error", message: "回答中断了，再发一次" };
      },
    };
  }

  root.U12Runtime = { collPath, makeDb, makeSample };
  if (!root.document || root.claude) return; // tests, or the local harness that brings its own window.claude

  /* ---------- sign-in overlay: email → 6-digit code (codes work inside the iPhone home-screen app, links don't) ---------- */
  const css = `
.auth{position:fixed;inset:0;z-index:100;background:var(--bg,#EDEDED);display:flex;align-items:center;justify-content:center;padding:16px}
.auth-card{box-sizing:border-box;width:100%;max-width:360px;background:var(--bubble-in,#fff);border-radius:12px;padding:20px;display:grid;gap:12px;font:400 16px/1.5 var(--f-body,system-ui)}
.auth-card h1{margin:0;font-size:20px}.auth-card p{margin:0}
.auth-card label{display:grid;gap:4px;font-size:13px;color:var(--muted,#7F7F7F)}
.auth-card input{font:400 18px var(--f-body,system-ui);color:var(--ink,#191919);background:var(--bg,#EDEDED);border:1px solid var(--line,#DADADA);border-radius:8px;padding:10px 12px}
.auth-card button{font:600 16px var(--f-body,system-ui);color:var(--accent-ink,#fff);background:var(--accent,#07A35A);border:0;border-radius:8px;padding:12px;cursor:pointer}
.auth-card button:disabled{opacity:.6}.auth-card .link{background:none;color:var(--accent,#07A35A);padding:0;font-weight:400;font-size:14px;justify-self:start}
.auth-msg{font-size:14px;min-height:1.5em}.auth-msg.err{color:var(--err,#A11D1D)}
.auth-note{font-size:12px;color:var(--muted,#7F7F7F)}
.auth-out{font:400 14px var(--f-body,system-ui);color:var(--muted,#7F7F7F);background:none;border:1px solid var(--line,#DADADA);border-radius:6px;padding:8px 12px;cursor:pointer;justify-self:start}`;
  const h = (tag, attrs, ...kids) => { const n = document.createElement(tag); Object.assign(n, attrs || {}); n.append(...kids.filter(Boolean)); return n; };
  const authMessage = (e) => {
    const m = String((e && e.message) || e);
    if (/signups? not allowed|not found|user not/i.test(m)) return "这个邮箱还没被邀请，请联系管理员。";
    if (/failed to fetch|network|load failed/i.test(m)) return "网络连不上，请检查网络后再试。";
    if (/rate limit|too many|seconds/i.test(m)) return "发送太频繁，请过一分钟再试。";
    if (/expired|invalid|token/i.test(m)) return "验证码不对或已过期，请重新输入或重新发送。";
    return `出错了：${m}`;
  };

  function signIn(client) {
    return new Promise((resolve) => {
      document.head.append(h("style", { textContent: css }));
      const msg = h("p", { className: "auth-msg", role: "status" });
      const say = (text, isErr) => { msg.textContent = text; msg.className = "auth-msg" + (isErr ? " err" : ""); };
      const card = h("div", { className: "auth-card" });
      const overlay = h("div", { className: "auth", role: "dialog", ariaModal: "true", ariaLabel: "登录" }, card);
      let email = "";
      const showEmail = () => {
        const input = h("input", { type: "email", required: true, autocomplete: "email", placeholder: "you@example.com", value: email });
        const btn = h("button", { type: "submit", textContent: "发送验证码" });
        const form = h("form", {}, h("label", {}, "邮箱", input), btn);
        form.style.cssText = "display:grid;gap:12px";
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          email = input.value.trim();
          btn.disabled = true; btn.textContent = "正在发送…"; say("");
          const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
          btn.disabled = false; btn.textContent = "发送验证码";
          if (error) { console.warn("otp send failed", error); say(authMessage(error), true); return; }
          showCode();
        });
        card.replaceChildren(h("h1", { textContent: "U12 备课助手" }), h("p", { textContent: "输入你被邀请的邮箱，我们会发一个 6 位验证码。" }), form, msg,
          h("p", { className: "auth-note", textContent: "计划由 DeepSeek 生成（服务器在中国），请不要输入孩子的全名。" }));
        input.focus();
      };
      const showCode = () => {
        const input = h("input", { type: "text", inputMode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]{6}", maxLength: 6, required: true, placeholder: "123456" });
        const btn = h("button", { type: "submit", textContent: "登录" });
        const back = h("button", { type: "button", className: "link", textContent: "换个邮箱 / 重新发送" });
        back.addEventListener("click", () => { say(""); showEmail(); });
        const form = h("form", {}, h("label", {}, "验证码", input), btn);
        form.style.cssText = "display:grid;gap:12px";
        form.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          btn.disabled = true; btn.textContent = "正在登录…"; say("");
          const { data, error } = await client.auth.verifyOtp({ email, token: input.value.trim(), type: "email" });
          if (error || !data.session) { btn.disabled = false; btn.textContent = "登录"; console.warn("otp verify failed", error); say(authMessage(error || "没有拿到登录状态"), true); return; }
          overlay.remove();
          resolve(data.session);
        });
        card.replaceChildren(h("h1", { textContent: "输入验证码" }), h("p", { textContent: `验证码已发送到 ${email}，几分钟内有效。` }), form, back, msg);
        input.focus();
      };
      document.body.append(overlay);
      showEmail();
    });
  }

  function addSignOut(client, email) {
    const panel = document.querySelector("#sheet .panel");
    const before = document.getElementById("close-sheet");
    if (!panel || !before) { console.warn("settings sheet not found; no sign-out button"); return; }
    const btn = h("button", { type: "button", className: "auth-out", textContent: `退出登录（${email}）` });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const { error } = await client.auth.signOut();
      if (error) { console.error("sign-out failed", error); btn.disabled = false; btn.textContent = `退出失败：${error.message}`; return; }
      location.reload();
    });
    before.before(btn);
  }

  let booted = null;
  const boot = () => booted || (booted = (async () => {
    const res = await fetch("/api/config");
    const cfg = await res.json().catch((e) => ({ message: `配置读取失败（${e.message}）` }));
    if (!res.ok || !cfg.supabaseUrl) throw new Error(cfg.message || `配置读取失败（${res.status}）`);
    let mod;
    try { mod = await import(SUPABASE_ESM); }
    catch (e) { throw new Error(`登录组件加载失败，请检查网络后刷新（${e.message}）`); }
    const client = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const { data, error } = await client.auth.getSession();
    if (error) console.warn("stored session unreadable", error);
    const session = (data && data.session) || (await signIn(client));
    addSignOut(client, session.user.email || "");
    return { client, session };
  })());

  root.claude = {
    use: async (name) => {
      const { client, session } = await boot();
      if (name === "db") return makeDb(client, session.user.id);
      if (name === "user") return { id: async () => session.user.id };
      if (name === "sample") {
        const token = async () => { const { data } = await client.auth.getSession(); return (data.session && data.session.access_token) || ""; };
        const relogin = () => { client.auth.signOut().catch((e) => console.error("sign-out failed", e)).finally(() => location.reload()); };
        return makeSample(root.fetch.bind(root), token, relogin);
      }
      return null;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
