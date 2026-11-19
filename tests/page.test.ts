import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The Artifact host used to wrap the page with a doctype, charset and viewport; served from Vercel the page must carry them itself.
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const head = html.slice(0, html.indexOf("<style>"));

test("page declares doctype, UTF-8 and a phone viewport before anything else", () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(head, /<meta charset="utf-8">/i);
  assert.match(head, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.match(head, /<html lang="zh">/);
});

test("runtime.js loads before the page script", () => {
  const rt = html.indexOf('<script src="runtime.js"></script>');
  const page = html.indexOf("<script>");
  assert.ok(rt > 0 && rt < page);
});

test("sign-in card counts its padding inside its width (no overflow on a 375 px phone)", () => {
  const rt = readFileSync(new URL("../public/runtime.js", import.meta.url), "utf8");
  assert.match(rt, /\.auth-card\{[^}]*box-sizing:border-box/);
});

test("no user-facing text names Claude (the hosted app runs on DeepSeek)", () => {
  const strings = html.match(/"[^"\n]*Claude[^"\n]*"/g) || [];
  assert.deepEqual(strings, []);
});

// Go-live finding: this Supabase project sends 8-digit codes; the input only took 6. Supabase allows 6 to 10.
test("sign-in code input takes 6 to 10 digits", () => {
  const rt = readFileSync(new URL("../public/runtime.js", import.meta.url), "utf8");
  assert.match(rt, /pattern: "\[0-9\]\{6,10\}", maxLength: 10/);
  assert.doesNotMatch(rt, /6 位/);
});
