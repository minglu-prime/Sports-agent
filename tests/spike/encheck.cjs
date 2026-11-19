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

// Live finding (2026-11-20): an English step read "A1 has the ball at 弧顶". Spot ids belong in ort/nach only.
for (const sprache of ["en", "de"]) {
  const p = detailPrompt({ ...base, sprache }, "technik", { name: "x" });
  ok(p.includes("中文地点名只写在 ort 和 nach 里"), sprache + ": steps must describe positions in the output language");
}
ok(!detailPrompt(base, "technik", { name: "x" }).includes("中文地点名只写在"), "Chinese prompt unchanged");
console.log("en steps ok");

// The prompt alone was not enough: one of four live pictures still had "the top (弧顶)". Code now cleans the step text.
const { localizeSpots } = new Function("document", pure.replace("const state", "var state") + ";return {localizeSpots}")({ getElementById() {} });
const det = () => ({ schritte: ["Offence starts at the top (弧顶) and right wing（右侧翼）.", "A2 cuts to 后场罚球线, then 前场左底角."], fehler: ["Standing at 弧顶 → move"], diagramm: { feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort: "弧顶" }], aktionen: [] } });
const e = localizeSpots(det(), "en");
ok(e.schritte[0] === "Offence starts at the top and right wing.", "doubled names lose the Chinese id: " + e.schritte[0]);
ok(e.schritte[1] === "A2 cuts to backcourt free-throw line, then left corner.", "bare ids are translated: " + e.schritte[1]);
ok(e.fehler[0] === "Standing at top of the key → move", e.fehler[0]);
ok(e.diagramm.elemente[0].ort === "弧顶", "the diagram keeps its ids");
const g = localizeSpots(det(), "de");
ok(g.schritte[1].includes("Freiwurflinie") && g.schritte[1].includes("linke Ecke") && !/[\u4e00-\u9fff]/.test(g.schritte.join("")), "German names: " + g.schritte[1]);
ok(JSON.stringify(localizeSpots(det(), "zh")) === JSON.stringify(det()), "Chinese output is left alone");
ok(localizeSpots(null, "en") === null, "no detail");
const spotIds = src.slice(src.indexOf("const HALF_SPOTS"), src.indexOf("const finite01")).match(/"([^"]+)": \[/g).map((x) => x.slice(1, -4));
const probe = localizeSpots({ schritte: spotIds.concat("中圈"), fehler: [] }, "en").schritte.concat(localizeSpots({ schritte: spotIds.concat("中圈"), fehler: [] }, "de").schritte);
ok(spotIds.length === 18 && !probe.some((x) => /[\u4e00-\u9fff]/.test(x)), "every court spot has an English and a German name: " + probe.filter((x) => /[\u4e00-\u9fff]/.test(x)));
console.log("spots ok");
