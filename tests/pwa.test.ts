import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const pub = (p: string) => new URL(`../public/${p}`, import.meta.url);
/** Width and height from a PNG's IHDR chunk (bytes 16–23, big-endian). */
const pngSize = (p: string) => { const b = readFileSync(pub(p)); assert.equal(b.toString("latin1", 1, 4), "PNG"); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("manifest makes the planner installable full-screen", () => {
  const m = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));
  assert.equal(m.name, "U12 备课助手");
  assert.equal(m.short_name, "U12备课");
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/");
  assert.equal(m.background_color, "#EDEDED");
  assert.equal(m.theme_color, "#EDEDED");
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes).sort();
  assert.deepEqual(sizes, ["192x192", "512x512"]);
  for (const i of m.icons) {
    assert.ok(existsSync(pub(i.src.replace(/^\//, ""))), `${i.src} exists`);
    assert.deepEqual(pngSize(i.src.replace(/^\//, "")), i.sizes.split("x").map(Number));
  }
});

test("iPhone home-screen icon is a 180 px PNG", () => {
  assert.deepEqual(pngSize("icons/apple-touch-icon.png"), [180, 180]);
});

test("page links the manifest and the iOS home-screen settings", () => {
  const html = readFileSync(pub("index.html"), "utf8");
  const head = html.slice(0, html.indexOf("<style>"));
  assert.match(head, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(head, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png">/);
  assert.match(head, /<meta name="theme-color" content="#EDEDED">/);
  assert.match(head, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(head, /<meta name="apple-mobile-web-app-title" content="U12备课">/);
});
