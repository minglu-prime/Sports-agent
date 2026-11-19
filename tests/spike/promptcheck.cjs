// failing-first check from the prompt evaluation (2026-11-14): a ball lying on the floor (e.g. 数字抢球) could not be drawn,
// because the detail prompt did not offer the "ball" element type that the court drawing supports
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const pure = src.slice(src.indexOf("const PHASES"), src.indexOf("/* ---------- settings"));
const fmt = src.slice(src.indexOf("const phaseMeta"), src.indexOf("function planCard"));
const spots = src.slice(src.indexOf("const SVGNS"), src.indexOf("function courtSvg"));
const dp = src.slice(src.indexOf("function detailPrompt"), src.indexOf("const loadingDrills"));
const { detailPrompt } = new Function("document", pure.replace("const state", "var state") + fmt + spots + dp + ";return {detailPrompt}")({ getElementById() {} });
const p = detailPrompt({ spieler: 12, koerbe: 2 }, "aktivierung", { name: "数字抢球" });
if (!/"typ": "spieler"\|"verteidiger"\|"huetchen"\|"trainer"\|"ball"/.test(p)) throw new Error("detail prompt must offer the ball element type");
if (!p.includes("地上")) throw new Error("detail prompt must say when to use a ball element");
console.log("prompt ok");
