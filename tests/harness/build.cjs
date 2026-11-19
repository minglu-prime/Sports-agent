// Builds harness/page.html: the real page with mock.js standing in for the artifact runtime.
// node tests/harness/build.cjs, then serve tests/harness (python -m http.server 8765) and open /page.html
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");
const head = '<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><script src="mock.js"></script>';
// the harness brings its own window.claude (mock.js); the hosted runtime is left out
const page = src.replace(/<script src="runtime\.js"><\/script>\r?\n/, "").replace(/^<!doctype html>\r?\n/i, "");
if (page === src) throw new Error("runtime.js script tag not found in public/index.html");
fs.writeFileSync(path.join(__dirname, "page.html"), head + page);
fs.copyFileSync(path.join(__dirname, "..", "..", "public", "i18n.js"), path.join(__dirname, "i18n.js"));
console.log("built page.html");
