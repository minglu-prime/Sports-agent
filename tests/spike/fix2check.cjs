// failing-first checks for the second review: null entries from the model, held order, picture carry-over keyed by setup too
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const code = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const A = new Function("document", code.replace("const state", "var state") + ";return {cleanPlan, recentHeld, carryDetails, validatePlan}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

// the model may answer with null entries; rendering assumed objects and crashed the thread on every load
const dirty = { titel: "x", phasen: [null, { id: "aufwaermen", minuten: 5, uebungen: [null, { name: "a", minuten: 5 }, "junk"] }, { id: "spiel" }] };
const c = A.cleanPlan(dirty);
ok(c.phasen.length === 2 && c.phasen[0].uebungen.length === 1 && c.phasen[0].uebungen[0].name === "a", "null and non-object entries dropped: " + JSON.stringify(c));
ok(Array.isArray(c.phasen[1].uebungen) && c.phasen[1].uebungen.length === 0, "missing drill list becomes empty, so the validator reports it");
ok(A.validatePlan(c, { dauer: 90, spielMin: 20 }, []).some((p) => p.includes("没有练习")), "empty phase still reported");
ok(A.cleanPlan(null) === null && A.cleanPlan({ titel: "no phases" }).phasen === undefined, "no plan / no phases left for the validator to report");

// no-repeat window: the sessions most recently marked held, not the plans most recently written
const docs = [
  { ts: "2026-11-02", heldAt: "2026-11-20", plan: { n: "A" } },
  { ts: "2026-11-10", heldAt: "2026-11-11", plan: { n: "B" } },
  { ts: "2026-11-09", plan: { n: "old record without heldAt" } },
];
ok(A.recentHeld(docs, 2).map((p) => p.n).join(",") === "A,B", "sorted by heldAt, falling back to ts: " + JSON.stringify(A.recentHeld(docs, 2)));

// a changed setup (more groups) needs a new picture even when the rules text stayed the same
const det = { schritte: ["s"], fehler: [], diagramm: { feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort: "弧顶" }], aktionen: [] } };
const base = { phasen: [{ id: "technik", uebungen: [{ name: "2打1", regeln: "r", aufbau: "两组", detail: det }] }] };
const next = { phasen: [{ id: "technik", uebungen: [{ name: "2打1", regeln: "r", aufbau: "三组" }] }] };
ok(A.carryDetails(next, base) === 0, "setup changed: no carry-over");
console.log("fix2 ok");
