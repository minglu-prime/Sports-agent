import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

// Review finding I1: @vercel/node compiles api/*.ts with the project's own "typescript" package.
// TypeScript 7 (native) has no JS compiler API, so the Vercel build would break.
test("the typescript package exposes the compiler API Vercel uses", () => {
  const ts = createRequire(import.meta.url)("typescript");
  assert.equal(typeof ts.transpileModule, "function", `typescript ${ts.version} has no transpileModule`);
});

// Review finding I3b: without supportsCancellation Vercel never fires request.signal, so 停止 doesn't stop DeepSeek.
test("api/sample.ts may run 300 s and is cancelled when the coach stops", () => {
  const v = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(v.functions["api/sample.ts"], { maxDuration: 300, supportsCancellation: true });
  assert.deepEqual(v.regions, ["fra1"]);
});
