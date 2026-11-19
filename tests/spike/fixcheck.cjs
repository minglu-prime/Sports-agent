// failing-first checks for review findings: broken pictures count as missing, repair prompt keeps the no-repeat context
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "trainingsplaner.html", "utf8");
const code = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const A = new Function("document", code.replace("const state", "var state") + ";return {needsPicture, reuseDetails, carryDetails, repairPrompt}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

const good = { schritte: ["s"], fehler: [], diagramm: { feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort: "弧顶" }], aktionen: [] } };
const textOnly = { schritte: ["s"], fehler: [], diagramm: null };
ok(A.needsPicture({ name: "x" }) && A.needsPicture({ name: "x", detail: textOnly }) && !A.needsPicture({ name: "x", detail: good }), "text-only answer counts as missing picture");

const lib = [{ rating: "up", name: "头胸球", drill: { detail: textOnly } }];
const plan = () => ({ phasen: [{ id: "aktivierung", uebungen: [{ name: "头胸球", regeln: "r" }] }] });
ok(A.reuseDetails(plan(), lib) === 0, "broken library picture not reused");
ok(A.carryDetails(plan(), { phasen: [{ id: "aktivierung", uebungen: [{ name: "头胸球", regeln: "r", detail: textOnly }] }] }) === 0, "broken picture not carried");

const input = { dauer: 90, spieler: 12, koerbe: 2, spielMin: 20, material: "", kalt: true };
const recent = [{ phasen: [{ id: "aktivierung", uebungen: [{ name: "数字抢球" }] }] }];
const rp = A.repairPrompt(input, plan(), ["x"], recent, [{ rating: "down", name: "动物走" }]);
ok(rp.includes("数字抢球") && rp.includes("动物走"), "repair prompt must carry recent drills and the library");
console.log("fix ok");
