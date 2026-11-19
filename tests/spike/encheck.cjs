// failing-first check: English as a third language for the drill content (next to Chinese and German)
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const pure = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const fmt = src.slice(src.indexOf("const phaseMeta"), src.indexOf("function planCard")) + src.slice(src.indexOf("function detailPrompt"), src.indexOf("const loadingDrills"));
const { systemText, planAsText, detailPrompt } = new Function("document", pure.replace("const state", "var state") + fmt + ";const HALF_SPOTS={弧顶:1};return {systemText, planAsText, detailPrompt}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

const base = { dauer: 90, spieler: 12, koerbe: 2, spielMin: 20, material: "", kalt: true };
const en = systemText({ ...base, sprache: "en" });
ok(en.includes("英语") && !en.includes("用中文回答") && !en.includes("德语"), "en: English content: " + en.slice(0, 90));
ok(systemText({ ...base, sprache: "de" }).includes("德语"), "de unchanged");
ok(systemText(base).includes("用中文回答"), "default unchanged");

const dp = detailPrompt({ ...base, sprache: "en" }, "technik", { name: "2-on-1" });
ok(dp.includes("英语") && dp.includes("地点名照抄"), "detail prompt: English text, spot names stay Chinese ids");

const plan = { titel: "Fast break", materialhinweis: "Balls", phasen: [{ id: "aufwaermen", minuten: 12, uebungen: [{ name: "Fire and ice", minuten: 12, regeln: "R.", wettkampf: "W", coachingCue: "Go!" }] }] };
const t = planAsText(plan, { ...base, sprache: "en" });
ok(t === 'Fast break (90 min)\n\n[Warm-up] 12 min\n· Fire and ice (12′) R. Scoring: W Cue: "Go!"\n\nEquipment: Balls', "English copy text: " + JSON.stringify(t));
console.log("en ok");
