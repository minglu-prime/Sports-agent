// failing-first check for the bug "diagram missing, only text shown silently"
const fs=require("fs");const src=fs.readFileSync(process.argv[2]||"trainingsplaner.html","utf8");
const i=src.indexOf("const PHASES");if(src.indexOf("function normalizeDetail")<0)throw new Error("normalizeDetail missing");
const code=src.slice(i,src.indexOf("/* ---------- settings"));
const normalizeDetail=new Function("document",code.replace("const state","var state")+";return normalizeDetail")({getElementById(){}});
const textOnly=normalizeDetail({schritte:["a","b"],fehler:["x"]});
if(textOnly.problem!=="这次回答里没有场地图")throw new Error("text-only answer must be reported: "+JSON.stringify(textOnly));
const alt=normalizeDetail({schritte:[],diagram:{feld:"halb",elemente:[{id:"A1",typ:"spieler",ort:"弧顶"}],aktionen:[]}});
if(alt.problem||!alt.detail.diagramm)throw new Error("diagram key variant: "+JSON.stringify(alt));
const empty=normalizeDetail({diagramm:{feld:"halb",elemente:[]}});if(!empty.problem)throw new Error("empty diagram must be reported");
if(normalizeDetail(null).detail!==null)throw new Error("null answer");
const u=normalizeDetail({schritte:["s"],fehler:undefined,diagramm:{feld:"halb",elemente:[{id:"A1",typ:"spieler",ort:"弧顶",ball:undefined}]}});
if(JSON.stringify(u.detail).includes("undefined")||"ball" in u.detail.diagramm.elemente[0])throw new Error("undefined must be stripped");
console.log("detail ok");
