// Runs every spike check against the page: node tests/spike/all.cjs
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const page = path.join(__dirname, "..", "..", "public", "index.html");
const src = fs.readFileSync(page, "utf8");
const tmp = path.join(require("os").tmpdir(), "u12-page-script.js");
fs.writeFileSync(tmp, src.slice(src.indexOf("<script>") + 8, src.lastIndexOf("</script>")));
execFileSync(process.execPath, ["--check", tmp], { stdio: "inherit" });
let failed = 0;
for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith(".cjs") && f !== "all.cjs" && f !== "eval-answers.cjs").sort()) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, f), page], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    console.log(`pass ${f}: ${out.trim().split("\n")[0].slice(0, 60)}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}:\n${(e.stderr || e.stdout || e.message).toString().trim()}`);
  }
}
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
