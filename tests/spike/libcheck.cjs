// failing-first check for the drill library: stable keys, disliked drills rejected, liked drills listed for Claude, saved pictures reused
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "trainingsplaner.html", "utf8");
const code = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const api = new Function("document", code.replace("const state", "var state") + ";return {validatePlan, libKey, libText, reuseDetails}")({ getElementById() {} });
const { validatePlan, libKey, libText, reuseDetails } = api;
const ok = (c, m) => { if (!c) throw new Error(m); };

// same drill, different spacing or punctuation: one library entry; safe doc id
ok(libKey("头-胸-球 游戏") === libKey("头胸球游戏"), "key must ignore spaces and punctuation");
ok(libKey("头胸球") !== libKey("抢尾巴"), "different drills need different keys");
ok(/^lib_[0-9a-z]+$/.test(libKey("2打1 / 快攻")), "key must be a safe doc id: " + libKey("2打1 / 快攻"));

const d = (n, m) => ({ name: n, minuten: m, ziele: ["反应"], aufbau: "a", regeln: "r", wettkampf: "w", coachingCue: "c", leichter: "l", schwerer: "s" });
const plan = { phasen: [["aufwaermen", [d("冰火人", 12)]], ["mobilisation", [d("动物走", 10)]], ["aktivierung", [d("头胸球", 8)]], ["technik", [d("2打1", 35)]], ["spiel", [d("比赛", 25)]]]
  .map(([id, u]) => ({ id, minuten: u.reduce((a, x) => a + x.minuten, 0), uebungen: u })) };
const inp = { dauer: 90, spielMin: 20, kalt: true };
ok(validatePlan(plan, inp, [], []).length === 0, "good plan passes");
const p = validatePlan(plan, inp, [], ["动物 走"]);
ok(p.length === 1 && p[0].includes("动物走") && p[0].includes("👎"), "disliked drill must be reported: " + JSON.stringify(p));
ok(validatePlan(plan, inp, []).length === 0, "old callers without the disliked list still work");

const lib = [
  { rating: "up", phase: "aktivierung", name: "头胸球", ts: "2026-11-10", drill: { regeln: "教练喊头胸球，孩子摸对应部位" } },
  { rating: "down", phase: "mobilisation", name: "动物走", ts: "2026-11-11", drill: {} },
];
const t = libText(lib);
ok(t.includes("头胸球") && t.includes("神经激活") && t.includes("教练喊头胸球"), "liked drills listed with phase and rules: " + t);
ok(t.includes("动物走") && /不喜欢/.test(t), "disliked drills listed: " + t);
ok(libText([]) === "", "empty library adds nothing to the prompt");

const det = { schritte: ["s"], fehler: [], diagramm: { feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort: "弧顶" }], aktionen: [] } };
const withPic = [{ rating: "up", name: "头-胸-球", phase: "aktivierung", drill: { detail: det } }, { rating: "down", name: "比赛", drill: { detail: det } }];
const copy = JSON.parse(JSON.stringify(plan));
ok(reuseDetails(copy, withPic) === 1, "one liked picture reused");
ok(copy.phasen[2].uebungen[0].detail.diagramm.elemente[0].ort === "弧顶" && copy.phasen[2].uebungen[0].detail.fromLib === true, "picture copied and marked");
ok(!copy.phasen[4].uebungen[0].detail, "disliked entries never supply pictures");
copy.phasen[2].uebungen[0].detail.schritte.push("x");
ok(det.schritte.length === 1, "copied picture must not share objects with the library");
ok(reuseDetails({}, withPic) === 0, "malformed plan is fine");
console.log("lib ok");
