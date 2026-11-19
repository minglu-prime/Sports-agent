import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type Row = { owner: string; coll: string; id: string; data: Record<string, unknown>; updated_at?: string };
type Rt = {
  collPath(path: string, uid: string): string;
  makeDb(client: unknown, uid: string): any;
  makeSample(fetchFn: unknown, getToken: () => Promise<string>, onUnauthorized: () => void): any;
};

/** Loads public/runtime.js like a browser would, minus the DOM, and returns its test exports. */
function loadRuntime(): Rt {
  const ctx = vm.createContext({ console, crypto, TextDecoder, TextEncoder, JSON, Promise, Uint8Array, Error });
  vm.runInContext(readFileSync(new URL("../public/runtime.js", import.meta.url), "utf8"), ctx);
  return (ctx as { U12Runtime: Rt }).U12Runtime;
}

/** In-memory stand-in for supabase-js `from("docs")`: just the PostgREST calls the runtime makes, with the same results. */
function fakeSupabase(rows: Row[] = []) {
  const calls: unknown[][] = [];
  const val = (r: Row, k: string) => (k.startsWith("data->>") ? (r.data[k.slice(7)] == null ? null : String(r.data[k.slice(7)])) : (r as Record<string, unknown>)[k]);
  const from = (table: string) => {
    assert.equal(table, "docs");
    const ops: unknown[][] = [];
    const b: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "limit", "insert", "upsert", "update", "delete", "maybeSingle"]) b[op] = (...a: unknown[]) => { ops.push([op, ...a]); calls.push([op, ...a]); return b; };
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve().then(() => {
      let sel = rows;
      const filters = ops.filter((o) => o[0] === "eq") as [string, string, unknown][];
      const match = (r: Row) => filters.every(([, k, v]) => val(r, k) === v);
      const write = ops.find((o) => ["insert", "upsert", "update", "delete"].includes(o[0] as string));
      if (write?.[0] === "insert" || write?.[0] === "upsert") {
        const r = write[1] as Row;
        const i = rows.findIndex((x) => x.owner === r.owner && x.coll === r.coll && x.id === r.id);
        if (i >= 0 && write[0] === "insert") return { data: null, error: { code: "23505", message: "duplicate key" } };
        if (i >= 0) rows[i] = r; else rows.push(r);
        return { data: null, error: null };
      }
      if (write?.[0] === "update") { rows.filter(match).forEach((r) => Object.assign(r, write[1])); return { data: null, error: null }; }
      if (write?.[0] === "delete") { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); return { data: null, error: null }; }
      sel = sel.filter(match);
      const ord = ops.find((o) => o[0] === "order") as [string, string, { ascending: boolean }] | undefined;
      if (ord) sel = [...sel].sort((a, c) => (String(val(a, ord[1])) < String(val(c, ord[1])) ? -1 : 1) * (ord[2].ascending ? 1 : -1));
      const lim = ops.find((o) => o[0] === "limit") as [string, number] | undefined;
      if (lim) sel = sel.slice(0, lim[1]);
      const out = sel.map((r) => ({ id: r.id, data: JSON.parse(JSON.stringify(r.data)) }));
      return { data: ops.some((o) => o[0] === "maybeSingle") ? out[0] ?? null : out, error: null };
    }).then(res, rej);
    return b;
  };
  return { client: { from }, rows, calls };
}

const rt = loadRuntime();

test("collection paths map onto coll, foreign paths are rejected", () => {
  assert.equal(rt.collPath("data/users/u1", "u1"), "");
  assert.equal(rt.collPath("data/users/u1/t_1/msgs", "u1"), "t_1/msgs");
  assert.throws(() => rt.collPath("data/users/u2/t_1/msgs", "u1"));
});

test("where/orderBy/limit return the matching docs, newest first, frozen", async () => {
  const { client } = fakeSupabase([
    { owner: "u1", coll: "", id: "t_a", data: { kind: "thread", updatedAt: "2026-11-01" } },
    { owner: "u1", coll: "", id: "t_b", data: { kind: "thread", updatedAt: "2026-11-03" } },
    { owner: "u1", coll: "", id: "h_x", data: { kind: "held", ts: "2026-11-02", plan: { phasen: [] } } },
    { owner: "u2", coll: "", id: "t_c", data: { kind: "thread", updatedAt: "2026-11-09" } },
  ]);
  const db = rt.makeDb(client, "u1");
  const snap = await db.collection("data/users/u1").where("kind", "==", "thread").orderBy("updatedAt", "desc").limit(5).get();
  assert.deepEqual(snap.docs.map((d: { id: string }) => d.id), ["t_b", "t_a"]);
  assert.equal(snap.empty, false);
  const held = (await db.collection("data/users/u1").where("kind", "==", "held").get()).docs[0].data();
  assert.ok(Object.isFrozen(held) && Object.isFrozen(held.plan), "reads are deep-frozen like the Artifact runtime");
  assert.equal((await db.collection("data/users/u1/t_z/msgs").get()).empty, true);
});

test("add makes a 20-char id; set/get/delete round-trip", async () => {
  const { client, rows } = fakeSupabase();
  const msgs = rt.makeDb(client, "u1").collection("data/users/u1/t_1/msgs");
  const ref = await msgs.add({ role: "coach", text: "练快攻", ts: "2026-11-19T10:00:00Z" });
  assert.match(ref.id, /^[a-z0-9]{20}$/);
  assert.equal(rows[0].coll, "t_1/msgs");
  assert.equal(rows[0].owner, "u1");
  await msgs.doc("m1").set({ text: "a" });
  assert.equal((await msgs.doc("m1").get()).data().text, "a");
  await msgs.doc("m1").delete();
  assert.equal((await msgs.doc("m1").get()).exists, false);
});

test("update merges fields and fails with not_found on a missing doc", async () => {
  const { client } = fakeSupabase([{ owner: "u1", coll: "", id: "t_1", data: { kind: "thread", title: "x" } }]);
  const col = rt.makeDb(client, "u1").collection("data/users/u1");
  await col.doc("t_1").update({ updatedAt: "2026-11-19" });
  assert.deepEqual({ ...(await col.doc("t_1").get()).data() }, { kind: "thread", title: "x", updatedAt: "2026-11-19" });
  await assert.rejects(col.doc("nope").update({ a: 1 }), (e: { code: string }) => e.code === "not_found");
});

test("writes with undefined fields are refused, like the Artifact database", async () => {
  const { client } = fakeSupabase();
  const col = rt.makeDb(client, "u1").collection("data/users/u1");
  await assert.rejects(col.doc("x").set({ a: undefined }), (e: { code: string }) => e.code === "invalid_argument");
  await assert.rejects(col.add({ plan: { b: undefined } }), (e: { code: string }) => e.code === "invalid_argument");
});

const ndjson = (lines: unknown[], status = 200) => new Response(lines.map((l) => JSON.stringify(l) + "\n").join(""), { status, headers: { "content-type": "application/x-ndjson" } });

test("sample streams progress into onText and resolves with the result", async () => {
  const seen: string[] = [];
  let sent: { url: string; init: RequestInit } | undefined;
  const fetchFn = async (url: string, init: RequestInit) => { sent = { url, init }; return ndjson([{ type: "progress", delta: "想" }, { type: "progress", delta: '{"a":1}' }, { type: "result", data: { a: 1 } }]); };
  const sample = rt.makeSample(fetchFn, async () => "tok", () => {});
  const out = await sample.json("只用JSON回答", { onText: ({ text }: { text: string }) => seen.push(text), cache: false });
  assert.deepEqual({ ...out }, { a: 1 });
  assert.deepEqual(seen, ["想", '想{"a":1}']);
  assert.equal(sent?.url, "/api/sample");
  assert.equal((sent?.init.headers as Record<string, string>).authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(sent?.init.body as string), { prompt: "只用JSON回答" });
});

test("sample: error line rejects with its code; 401 asks for sign-in again", async () => {
  const err = rt.makeSample(async () => ndjson([{ type: "error", code: "rate_limited", message: "今天的用量到上限了" }]), async () => "t", () => {});
  await assert.rejects(err.json("x"), (e: { code: string; message: string }) => e.code === "rate_limited" && e.message === "今天的用量到上限了");
  let relogin = 0;
  const expired = rt.makeSample(async () => Response.json({ code: "not_granted" }, { status: 401 }), async () => "t", () => { relogin++; });
  await assert.rejects(expired.json("x"), (e: { code: string }) => e.code === "not_granted");
  assert.equal(relogin, 1);
});

test("sample: stream ending without a result, a 500, or an abort all reject with a code", async () => {
  const cut = rt.makeSample(async () => ndjson([{ type: "progress", delta: "{" }]), async () => "t", () => {});
  await assert.rejects(cut.json("x"), (e: { code: string }) => e.code === "upstream_error");
  const down = rt.makeSample(async () => Response.json({ code: "upstream_error", message: "服务器没配置 DEEPSEEK_API_KEY" }, { status: 500 }), async () => "t", () => {});
  await assert.rejects(down.json("x"), (e: { message: string }) => e.message === "服务器没配置 DEEPSEEK_API_KEY");
  const aborted = rt.makeSample(async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; }, async () => "t", () => {});
  await assert.rejects(aborted.json("x", { signal: AbortSignal.abort() }), (e: { code: string }) => e.code === "cancelled");
});

// Review finding C1: with sign-ups off, an unconfirmed (invited) user gets "Signups not allowed"; say what to do.
test("sign-up-disabled error tells the coach to add the user in Supabase", () => {
  const m = (rt as unknown as { authMessage(e: unknown): string }).authMessage({ message: "Signups not allowed for otp" });
  assert.match(m, /Create new user/);
  assert.match(m, /Auto Confirm/);
});

// Review findings I4 and I5, wiring that only runs in a browser: checked in the source.
test("re-login signs out this device only, and a lost session sends the coach back to sign-in", () => {
  const src = readFileSync(new URL("../public/runtime.js", import.meta.url), "utf8");
  assert.equal((src.match(/signOut\(\{ scope: "local" \}\)/g) || []).length, 2, "both sign-out calls are local");
  assert.doesNotMatch(src, /signOut\(\)/);
  assert.match(src, /onAuthStateChange\(\(event\) => \{ if \(event === "SIGNED_OUT"\) location\.reload\(\); \}\)/);
});
