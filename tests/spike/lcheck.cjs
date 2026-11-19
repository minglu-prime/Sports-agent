const fs=require("fs");const src=fs.readFileSync(process.argv[2]||"trainingsplaner.html","utf8");
const js=src.slice(src.indexOf("const SVGNS"),src.indexOf("function courtSvg"));
const {layoutDiagram}=new Function(js+";return {layoutDiagram}")();
const changpao={feld:"ganz",elemente:[{id:"A1",typ:"spieler",ort:"后场篮下",ball:true},{id:"A2",typ:"spieler",ort:"中圈"},{id:"D1",typ:"verteidiger",ort:"中圈"},{id:"T",typ:"huetchen",ort:"中线中点"}],
 aktionen:[{nr:1,wer:"A2",typ:"lauf",nach:"右肘区"},{nr:1,wer:"D1",typ:"lauf",nach:"罚球线"},{nr:2,wer:"A1",typ:"pass",nach:"A2"},{nr:3,wer:"A2",typ:"wurf"}]};
const l=layoutDiagram(changpao);
const eq=(a,b)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9;
if(l.problems.length)throw l.problems;
const pass=l.arrows.find(a=>a.typ==="pass"), shot=l.arrows.find(a=>a.typ==="wurf");
if(!eq(pass.to,[66,41/2]))throw ["pass should end where A2 ran to",pass];
if(!eq(shot.from,[66,20.5])||!eq(shot.to,[50,5.6]))throw ["shot from A2 new spot to top basket",shot];
const a2=l.els.find(e=>e.id==="A2"),d1=l.els.find(e=>e.id==="D1");
if(Math.hypot(a2.x-d1.x,a2.y-d1.y)<3.5)throw "same-spot markers should be fanned out";
const bad=layoutDiagram({feld:"halb",elemente:[{id:"A1",typ:"spieler",ort:"火星"}],aktionen:[{nr:1,wer:"B9",typ:"lauf",nach:"篮下"}]});
if(bad.problems.length!==2)throw bad.problems;
console.log("layout ok", bad.problems);
