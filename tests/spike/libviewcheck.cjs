// failing-first check for the library view: liked drills grouped by phase in session order, newest first; disliked listed apart
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const code = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const { libGroups } = new Function("document", code.replace("const state", "var state") + ";return {libGroups}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

const lib = [
  { rating: "up", phase: "technik", name: "2打1", ts: "2026-11-10" },
  { rating: "up", phase: "aufwaermen", name: "冰火人", ts: "2026-11-09" },
  { rating: "up", phase: "technik", name: "3打2", ts: "2026-11-12" },
  { rating: "down", phase: "mobilisation", name: "动物走", ts: "2026-11-11" },
  { rating: "up", phase: "unbekannt", name: "怪练习", ts: "2026-11-01" },
];
const g = libGroups(lib);
ok(g.liked.map((x) => x.phase).join(",") === "aufwaermen,technik,unbekannt", "phases in session order, unknown last: " + JSON.stringify(g.liked.map((x) => x.phase)));
ok(g.liked[1].items.map((x) => x.name).join(",") === "3打2,2打1", "newest first inside a phase");
ok(g.disliked.length === 1 && g.disliked[0].name === "动物走", "disliked apart");
const e = libGroups([]);
ok(e.liked.length === 0 && e.disliked.length === 0, "empty library");
console.log("libview ok");
