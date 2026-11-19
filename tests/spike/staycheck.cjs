// failing-first check from the live English session (2026-11-20): the model wrote "A5 runs to 右底角" for a player
// already standing there. That is "stays", not a picture problem; 7 such warnings showed under 3 pictures.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const js = src.slice(src.indexOf("const SVGNS"), src.indexOf("function courtSvg"));
const { layoutDiagram } = new Function(js + ";return {layoutDiagram}")();
const d = layoutDiagram({ feld: "halb", elemente: [{ id: "A1", typ: "spieler", ort: "右底角" }, { id: "A2", typ: "spieler", ort: "弧顶", ball: true }],
  aktionen: [{ nr: 1, wer: "A1", typ: "lauf", nach: "右底角" }, { nr: 1, wer: "A2", typ: "dribbling", nach: "弧顶" }, { nr: 2, wer: "A2", typ: "pass", nach: "A1" }] });
if (d.problems.length) throw new Error("staying in place is not a problem: " + JSON.stringify(d.problems));
if (d.arrows.length !== 1 || d.arrows[0].typ !== "pass") throw new Error("only the pass is drawn: " + JSON.stringify(d.arrows.map((a) => a.typ)));
console.log("stay ok");
