// failing-first check for practice mode: plan flattened into timed steps, clock text
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "trainingsplaner.html", "utf8");
const code = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const { runSteps, clock } = new Function("document", code.replace("const state", "var state") + ";return {runSteps, clock}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

const d = (n, m) => ({ name: n, minuten: m });
const plan = { phasen: [{ id: "aufwaermen", uebungen: [d("冰火人", 12), d("抢尾巴", 3)] }, { id: "aktivierung", uebungen: [d("头胸球", 8), d("坏的", 0)] }, { id: "spiel", uebungen: [d("比赛", 25)] }] };
const s = runSteps(plan);
ok(s.length === 4, "drills without minutes are skipped: " + s.length);
ok(s[0].phaseId === "aufwaermen" && s[0].sec === 720 && s[0].start === 0, "first step");
ok(s[2].u.name === "头胸球" && s[2].start === 15 * 60, "start times add up");
ok(s[3].start + s[3].sec === 48 * 60, "end equals the plan's total");
ok(runSteps({}).length === 0 && runSteps(null).length === 0, "malformed plans give no steps");

ok(clock(720) === "12:00", clock(720));
ok(clock(59.2) === "1:00", "counts up to the next whole second: " + clock(59.2));
ok(clock(0) === "0:00", clock(0));
ok(clock(-61) === "-1:01", "overtime shows minus: " + clock(-61));
console.log("run ok");
