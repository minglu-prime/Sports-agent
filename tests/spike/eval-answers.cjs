// Scores model answers to the page's real prompts (not part of all.js: needs answer files).
// node tests/spike/eval-answers.cjs public/index.html tests/prompt-eval  (folder with p1_zh.json, p2_de.json, p3_*.json, p4_*.json)
const fs = require("fs");
const path = require("path");
const [page, dir] = process.argv.slice(2);
const src = fs.readFileSync(page, "utf8");
const pure = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const spots = src.slice(src.indexOf("const SVGNS"), src.indexOf("function courtSvg"));
const A = new Function("document", pure.replace("const state", "var state") + spots + ";return {validatePlan, normalizeDetail, layoutDiagram}")({ getElementById() {} });
const input = { dauer: 90, spieler: 12, koerbe: 2, spielMin: 20, kalt: true };
const prompt = (f) => fs.readFileSync(path.join(dir, f.replace(".json", ".txt")), "utf8");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  let ans;
  try { ans = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { console.log(f + ": not JSON (" + e.message + ")"); continue; }
  if (f.startsWith("p1") || f.startsWith("p2")) {
    const recent = prompt(f).match(/最近4节已上课用过的练习[^：]*：(.*)/);
    const held = recent ? [{ phasen: [{ id: "aktivierung", uebungen: recent[1].split("；").map((name) => ({ name })) }] }] : [];
    const disliked = (prompt(f).match(/孩子不喜欢的练习[^：]*：(.*)/) || [null, ""])[1].split("；").filter(Boolean);
    const probs = A.validatePlan(ans.plan, input, held, disliked);
    const drills = ((ans.plan && ans.plan.phasen) || []).flatMap((p) => (p.uebungen || []).map((u) => p.id + ":" + u.name + "(" + u.minuten + ")"));
    const cjk = JSON.stringify(ans, (k, v) => (k === "ziele" ? undefined : v)).match(/[一-鿿]/g) || [];
    console.log(f + ": " + (probs.length ? "PROBLEMS " + JSON.stringify(probs) : "valid") + (f.startsWith("p2") ? " | Chinese chars in German answer: " + cjk.length : ""));
    console.log("  " + drills.join(" | "));
  } else {
    const { detail, problem } = A.normalizeDetail(ans);
    const d = detail && detail.diagramm;
    const lay = d ? A.layoutDiagram(d) : null;
    console.log(f + ": " + (problem || "has diagram") + " | layout problems: " + (lay ? JSON.stringify(lay.problems) : "-"));
    if (d) console.log("  " + d.feld + " | " + d.elemente.map((e) => e.id + "@" + (Array.isArray(e.ort) ? "[" + e.ort + "]" : e.ort)).join(", ") + " | " + (d.aktionen || []).map((a) => a.nr + ":" + a.wer + " " + a.typ + (a.nach ? "→" + a.nach : "")).join(", "));
  }
}
