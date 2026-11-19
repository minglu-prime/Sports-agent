// Builds harness/page.html: the real page with mock.js standing in for the artifact runtime.
// node tests/harness/build.cjs, then serve tests/harness (python -m http.server 8765) and open /page.html
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");
const head = '<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style><script src="mock.js"></script>';
fs.writeFileSync(path.join(__dirname, "page.html"), head + src);
console.log("built page.html");
