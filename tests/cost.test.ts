import { test } from "node:test";
import assert from "node:assert/strict";
import { euros, overCap } from "../lib/cost.ts";

test("deepseek-flash: 1M in + 1M out at peak rates, in euros", () => {
  // (0.30 + 1.20) USD × 0.92 EUR/USD = 1.38 EUR (prices: api-docs.deepseek.com/quick_start/pricing, 2026-11-19, peak)
  assert.ok(Math.abs(euros("deepseek-flash", 1_000_000, 1_000_000) - 1.38) < 1e-9);
});

test("deepseek-v4-pro uses its own prices", () => {
  // 1M input at 1.32 USD → 1.2144 EUR
  assert.ok(Math.abs(euros("deepseek-v4-pro", 1_000_000, 0) - 1.2144) < 1e-9);
});

test("unknown model is a programming error", () => {
  assert.throws(() => euros("gpt-x", 1, 1), /unknown model/);
});

test("cap reached exactly counts as over", () => {
  assert.equal(overCap(3, 3), true);
  assert.equal(overCap(2.99, 3), false);
});
