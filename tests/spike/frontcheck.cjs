// failing-first check from the live run (2026-11-19): DeepSeek named a spot "前场右底角"; the page only knew "右底角"
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const js = src.slice(src.indexOf("const SVGNS"), src.indexOf("function courtSvg"));
const { layoutDiagram } = new Function(js + ";return {layoutDiagram}")();
for (const feld of ["ganz", "halb"]) {
  const a = layoutDiagram({ feld, elemente: [{ id: "A1", typ: "spieler", ort: "前场右底角" }], aktionen: [{ nr: 1, wer: "A1", typ: "lauf", nach: "前场罚球线" }] });
  const b = layoutDiagram({ feld, elemente: [{ id: "A1", typ: "spieler", ort: "右底角" }], aktionen: [{ nr: 1, wer: "A1", typ: "lauf", nach: "罚球线" }] });
  if (a.problems.length) throw new Error(feld + ": 前场 prefix not understood: " + JSON.stringify(a.problems));
  if (JSON.stringify(a.els) !== JSON.stringify(b.els) || JSON.stringify(a.arrows) !== JSON.stringify(b.arrows)) throw new Error(feld + ": 前场X must be the same place as X");
}
console.log("front ok");
