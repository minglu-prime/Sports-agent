import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type I18n = { translate(s: string): string; pickLang(stored: string | null, returning: boolean, nav: string): string };
const read = (p: string) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
function load(): I18n {
  const ctx = vm.createContext({ console });
  vm.runInContext(read("i18n.js"), ctx);
  return (ctx as { U12I18n: I18n }).U12I18n;
}
const i18n = load();
const CJK = /[\u4e00-\u9fff]/;
/** Chinese is allowed only inside quotes: that is the coach's or the model's own content (drill names, field keys). */
/** Not interface text: names of languages (shown in their own language, or used inside the Chinese prompts). */
const NAMES = new Set(["中文", "德语", "英语"]);
const leftover = (s: string) => !NAMES.has(s) && CJK.test(i18n.translate(s).replace(/"[^"]*"/g, ""));

test("language choice: stored wins; a returning coach stays Chinese; new visitors follow the browser", () => {
  assert.equal(i18n.pickLang("en", true, "zh-CN"), "en");
  assert.equal(i18n.pickLang("zh", false, "en-US"), "zh");
  assert.equal(i18n.pickLang(null, true, "de-DE"), "zh");
  assert.equal(i18n.pickLang(null, false, "zh-TW"), "zh");
  assert.equal(i18n.pickLang(null, false, "de-DE"), "en");
});

test("fixed texts and texts with values are translated", () => {
  assert.equal(i18n.translate("发送"), "Send");
  assert.equal(i18n.translate("标记已上课"), "Mark as held");
  assert.equal(i18n.translate("总时长 76 分钟，要求 90 分钟。"), "Total is 76 min, but 90 min are required.");
  assert.equal(i18n.translate("「热身」没有练习。"), '"Warm-up" has no drills.');
  assert.equal(i18n.translate("90分钟 · 12人 · 2筐 · 比赛≥20′ · 天冷  ✎"), "90 min · 12 players · 2 baskets · game ≥20′ · cold hall  ✎");
  assert.equal(i18n.translate("协调、反应"), "coordination, reaction");
  assert.equal(i18n.translate("出错了：用量到上限了，稍后再试（代码：rate_limited，今天的用量到上限了，明天再试）"),
    "Something went wrong: Usage limit reached, try again later (code: rate_limited, Today's usage limit is reached, try again tomorrow)");
});

// Found in the browser: part headings stayed Chinese, and 技术 came out as the lower-case goal word.
test("the five part headings are translated as headings", () => {
  assert.deepEqual(["热身", "灵活与弹跳", "神经激活", "技术", "比赛"].map((s) => i18n.translate(s)),
    ["Warm-up", "Mobility & jumping", "Neural activation", "Technique", "Game"]);
  assert.equal(i18n.translate("技术、速度"), "technique, speed");
});

test("the coach's and the model's own content is left alone", () => {
  assert.equal(i18n.translate("抢锥跑"), "抢锥跑");
  assert.equal(i18n.translate("这周就练快攻：长传敢传、2打1拉开。"), "这周就练快攻：长传敢传、2打1拉开。");
  assert.equal(i18n.translate("练习「抢锥跑」重复出现。"), 'Drill "抢锥跑" appears twice.');
});

/** The page's script without the parts that are not interface text: prompts for the model, court spot ids, phase table. */
function uiCode() {
  let s = read("index.html");
  s = s.slice(s.indexOf("<script>", s.indexOf("runtime.js")));
  const cut = (a: string, b: string) => { const i = s.indexOf(a), j = s.indexOf(b, i); assert.ok(i >= 0 && j > i, `markers ${a} … ${b}`); s = s.slice(0, i) + s.slice(j); };
  cut("const PHASES = [", "const RECENT_N");
  cut("/* ---------- prompts ---------- */\nfunction libText", "/* ---------- settings");
  cut("const SPOT_NAMES", "const needsPicture");
  cut("const HALF_SPOTS", "const finite01");
  cut("function courtSpots", "/**\n * Turns Claude");
  cut("function detailPrompt", "const loadingDrills");
  cut("function planAsText", "function planCard");
  return s.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, "")).join("\n");
}
/** String literals and templates that contain Chinese; ${…} becomes a sample value. */
function chineseLiterals(code: string) {
  let s = code;
  // optional parts (${cond ? " · 天冷" : ""}) are left out; values become a sample number
  for (let i = 0; i < 4; i++) s = s.replace(/\$\{[^{}`]*\?[^{}`]*: ""\}/g, "").replace(/\$\{[^{}`]*\}/g, "7");
  const out = new Set<string>();
  for (const m of s.matchAll(/"((?:[^"\\\n]|\\.)*)"|`([^`]*)`/g)) {
    const raw = m[1] ?? m[2];
    if (CJK.test(raw)) out.add(JSON.parse(`"${raw.replace(/\\(?!["\\nu])/g, "\\\\").replace(/\n/g, "\\n").replace(/(?<!\\)"/g, '\\"')}"`));
  }
  return [...out];
}

test("every interface text in the page has an English version", () => {
  const missing = chineseLiterals(uiCode()).filter(leftover);
  assert.deepEqual(missing, []);
});

test("every interface text in the sign-in and data layer has an English version", () => {
  const code = read("runtime.js").split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l) && !l.includes("示意图规则")).join("\n");
  const missing = chineseLiterals(code).filter(leftover);
  assert.deepEqual(missing, []);
});

test("server messages have an English version", () => {
  const server = ["lib/sample-handler.ts", "lib/deepseek.ts", "api/sample.ts", "api/config.ts"].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
  const code = server.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).map((l) => l.replace(/\s\/\/ .*$/, "")).join("\n");
  assert.deepEqual(chineseLiterals(code).filter(leftover), []);
});

test("static page text has an English version", () => {
  const html = read("index.html");
  const body = html.slice(html.indexOf("<aside"), html.indexOf('<script src="i18n.js">'));
  assert.ok(body.length > 500, "page links i18n.js after the static markup");
  const texts = [...body.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)].map((m) => m[1].trim())
    .concat([...body.matchAll(/(?:aria-label|placeholder)="([^"]*[\u4e00-\u9fff][^"]*)"/g)].map((m) => m[1]));
  assert.ok(texts.length > 15);
  assert.deepEqual(texts.filter(leftover), []);
});
