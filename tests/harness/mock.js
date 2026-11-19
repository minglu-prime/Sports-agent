// Test double for the artifact runtime: fixed plan + fixed diagram, an in-memory db kept in localStorage. Only used in the local harness.
(() => {
  const d = (n, m) => ({ name: n, minuten: m, ziele: ["反应"], aufbau: "半场", regeln: "规则说明", wettkampf: "计分", coachingCue: "快！", leichter: "慢一点", schwerer: "加防守" });
  const plan = { titel: "测试计划", materialhinweis: "球和桶", phasen: [
    ["aufwaermen", [d("冰火人", 12)]], ["mobilisation", [d("动物走", 10)]], ["aktivierung", [d("头胸球", 8)]],
    ["technik", [d("2打1快攻", 35)]], ["spiel", [d("比赛", 25)]]].map(([id, u]) => ({ id, minuten: u.reduce((a, x) => a + x.minuten, 0), uebungen: u })) };
  const detail = { schritte: ["A1 在弧顶持球", "A2 跑到右低位", "A1 传球", "A2 投篮"], fehler: ["传球太慢→提前看队友"],
    diagramm: { feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort: "弧顶", ball: true }, { id: "A2", typ: "spieler", ort: "右45度" }, { id: "D1", typ: "verteidiger", ort: "罚球线" }],
      aktionen: [{ nr: 1, wer: "A1", typ: "dribbling", nach: "左肘区" }, { nr: 1, wer: "A2", typ: "lauf", nach: "右低位" }, { nr: 2, wer: "A1", typ: "pass", nach: "A2" }, { nr: 3, wer: "A2", typ: "wurf" }] } };
  window.__calls = [];
  window.__planOverride = null; // set to a plan object to make the next plan answers return it
  window.__prompts = [];
  const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; }; // the real runtime returns frozen values
  const sample = { json: async (prompt) => { window.__calls.push(prompt.includes("示意图规则") ? "detail" : "plan"); window.__prompts.push(prompt); await new Promise((r) => setTimeout(r, 150));
    return deepFreeze(prompt.includes("示意图规则") ? JSON.parse(JSON.stringify(detail)) : { reply: "好了", plan: JSON.parse(JSON.stringify(window.__planOverride || plan)) }); } };

  // db: collections keyed by path, kept in localStorage so a reload sees the same data; reads come back frozen, undefined fields are refused
  const KEY = "mockdb";
  const load = () => JSON.parse(localStorage.getItem(KEY) || "{}");
  const save = (all) => localStorage.setItem(KEY, JSON.stringify(all));
  const hasUndef = (v) => v === undefined || (v && typeof v === "object" && Object.values(v).some(hasUndef));
  const check = (data) => { if (hasUndef(data)) throw { code: "invalid_argument", message: "undefined field" }; };
  const snap = (rows) => ({ empty: !rows.length, docs: rows.map(([id, v]) => ({ id, data: () => deepFreeze(JSON.parse(JSON.stringify(v))) })) });
  let seq = 0;
  const lag = () => new Promise((r) => setTimeout(r, window.__dbDelay || 0)); // set window.__dbDelay to reproduce races
  const query = (path, f = []) => ({
    where: (k, op, v) => query(path, [...f, (rows) => rows.filter(([, x]) => x[k] === v)]),
    orderBy: (k, dir = "asc") => query(path, [...f, (rows) => [...rows].sort((a, b) => (String(a[1][k]) < String(b[1][k]) ? -1 : 1) * (dir === "desc" ? -1 : 1))]),
    limit: (n) => query(path, [...f, (rows) => rows.slice(0, n)]),
    get: async () => (await lag(), snap(f.reduce((rows, fn) => fn(rows), Object.entries(load()[path] || {})))),
    add: async (data) => { await lag(); check(data); const id = "m" + Date.now().toString(36) + (seq++); const all = load(); (all[path] ||= {})[id] = data; save(all); return { id }; },
    doc: (id) => ({
      id,
      get: async () => { const v = (load()[path] || {})[id]; return { exists: !!v, id, data: () => (v ? deepFreeze(v) : undefined) }; },
      set: async (data) => { await lag(); check(data); const all = load(); (all[path] ||= {})[id] = data; save(all); },
      update: async (data) => { await lag(); check(data); const all = load(); const c = all[path] || {}; if (!c[id]) throw { code: "not_found", message: "no doc " + id }; c[id] = { ...c[id], ...data }; save(all); },
      delete: async () => { await lag(); const all = load(); if (all[path]) delete all[path][id]; save(all); },
    }),
  });
  const db = { collection: (path) => query(path) };
  const user = { id: async () => "u1" };
  window.claude = { use: async (n) => ({ sample, db, user })[n] || null };
})();
