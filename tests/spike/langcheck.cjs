// failing-first check for the output language setting: German drill content, Chinese stays the default
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "trainingsplaner.html", "utf8");
const pure = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const fmt = src.slice(src.indexOf("const phaseMeta"), src.indexOf("function planCard")) + src.slice(src.indexOf("function detailPrompt"), src.indexOf("const loadingDrills"));
const { systemText, planAsText, detailPrompt } = new Function("document", pure.replace("const state", "var state") + fmt + ";const HALF_SPOTS={弧顶:1};return {systemText, planAsText, detailPrompt}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

const base = { dauer: 90, spieler: 12, koerbe: 2, spielMin: 20, material: "", kalt: true };
ok(systemText(base).includes("用中文回答"), "no language set: Chinese (old saved messages)");
ok(systemText({ ...base, sprache: "zh" }).includes("用中文回答"), "zh: Chinese");
const de = systemText({ ...base, sprache: "de" });
ok(de.includes("德语") && !de.includes("用中文回答"), "de: German content: " + de.slice(0, 80));

const plan = { titel: "Schnellangriff", materialhinweis: "Bälle", phasen: [{ id: "aufwaermen", minuten: 12, uebungen: [{ name: "Feuer und Eis", minuten: 12, regeln: "R", wettkampf: "W", coachingCue: "Schnell!" }] }] };
const tde = planAsText(plan, { ...base, sprache: "de" });
ok(tde.includes("Aufwärmen") && tde.includes("90 Min") && tde.includes("Material") && !/[器材计分口令热身分钟]/.test(tde), "German copy text has no Chinese labels: " + tde);
const tzh = planAsText(plan, base);
ok(tzh.includes("【热身】") && tzh.includes("计分"), "Chinese copy text unchanged: " + tzh);

const dp = detailPrompt({ ...base, sprache: "de" }, "technik", { name: "2v1" });
ok(dp.includes("德语") && dp.includes("地点名照抄"), "detail prompt: German text, spot names stay Chinese ids");
ok(detailPrompt(base, "technik", { name: "2打1" }).includes("用中文"), "detail prompt default Chinese");
console.log("lang ok");
