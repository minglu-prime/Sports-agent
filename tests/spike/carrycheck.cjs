// failing-first check for the bug "editing a plan redraws every picture and sends old pictures to Claude"
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "trainingsplaner.html", "utf8");
const code = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const { carryDetails, chatPrompt, repairPrompt } = new Function("document", code.replace("const state", "var state") + ";return {carryDetails, chatPrompt, repairPrompt}")({ getElementById() {} });
const ok = (c, m) => { if (!c) throw new Error(m); };

const det = (ort) => ({ schritte: ["s"], fehler: [], diagramm: { feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort }], aktionen: [] } });
const d = (n, regeln, detail) => ({ name: n, minuten: 10, regeln, ...(detail ? { detail } : {}) });
const base = { phasen: [{ id: "aufwaermen", uebungen: [d("冰火人", "抓人", det("弧顶")), d("抢尾巴", "抢", det("左45度"))] }, { id: "technik", uebungen: [d("2打1", "快攻", det("右底角"))] }] };
const next = { phasen: [{ id: "aufwaermen", uebungen: [d("冰火人", "抓人"), d("新游戏", "新")] }, { id: "technik", uebungen: [d("2打1", "改成3打2快攻")] }] };

ok(carryDetails(next, base) === 1, "only the unchanged drill keeps its picture");
ok(next.phasen[0].uebungen[0].detail.diagramm.elemente[0].ort === "弧顶", "picture carried over");
ok(!next.phasen[0].uebungen[0].detail.fromLib, "carried pictures are not marked as library pictures");
ok(!next.phasen[1].uebungen[0].detail, "same name with new rules needs a new picture");
next.phasen[0].uebungen[0].detail.schritte.push("x");
ok(base.phasen[0].uebungen[0].detail.schritte.length === 1, "no shared objects with the old plan");
ok(carryDetails(next, null) === 0 && carryDetails({}, base) === 0, "missing plans are fine");

const input = { dauer: 90, spieler: 12, koerbe: 2, spielMin: 20, material: "", kalt: true };
const p = chatPrompt(input, [], base, [], "换一个", []);
ok(p.includes("冰火人") && !p.includes("diagramm") && !p.includes("schritte"), "old pictures must not be sent to Claude");
const rp = repairPrompt(input, base, ["x"]);
ok(rp.includes("冰火人") && !rp.includes("diagramm"), "repair prompt also without pictures");
console.log("carry ok");
