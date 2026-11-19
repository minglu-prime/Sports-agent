import { test } from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { handleSample, type SampleDeps } from "../lib/sample-handler.ts";

type Chunk = { choices: { delta: { content?: string }; finish_reason: string | null }[]; usage?: { prompt_tokens: number; completion_tokens: number } | null };
const answer = (text: string, p = 50, c = 10): Chunk[] => [
  { choices: [{ delta: { content: text }, finish_reason: "stop" }], usage: null },
  { choices: [], usage: { prompt_tokens: p, completion_tokens: c } },
];

function deps(over: Partial<SampleDeps> & { chunks?: Chunk[]; waitForAbort?: boolean } = {}) {
  const seen = { deepseekCalls: 0, usage: [] as unknown[][], signal: undefined as AbortSignal | undefined };
  const chunks = over.chunks ?? answer('{"plan":1}');
  const deepseek = { chat: { completions: { create: async (_b: unknown, o?: { signal?: AbortSignal }) => {
    seen.deepseekCalls++; seen.signal = o?.signal;
    return (async function* () {
      if (over.waitForAbort) await new Promise((r) => o?.signal?.addEventListener("abort", r));
      if (o?.signal?.aborted) { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
      yield* chunks;
    })();
  } } } } as unknown as OpenAI;
  const d: SampleDeps = {
    model: "deepseek-flash", effort: "high", capEuro: 3,
    userId: async (t) => (t === "good" ? "u1" : null),
    spentToday: async () => 0,
    addUsage: async (...a) => { seen.usage.push(a); },
    deepseek,
    ...over,
  };
  return { d, seen };
}
const req = (body: unknown, token: string | null = "good", signal?: AbortSignal) =>
  new Request("http://x/api/sample", { method: "POST", body: JSON.stringify(body), signal, headers: token ? { authorization: `Bearer ${token}` } : {} });
const lines = async (r: Response) => (await r.text()).trim().split("\n").map((l) => JSON.parse(l));

test("no or bad login → 401 not_granted, DeepSeek never called", async () => {
  const { d, seen } = deps();
  for (const t of [null, "bad"]) {
    const r = await handleSample(req({ prompt: "x" }, t), d);
    assert.equal(r.status, 401);
    assert.equal((await r.json()).code, "not_granted");
  }
  assert.equal(seen.deepseekCalls, 0);
});

test("missing prompt → 400; over 200 000 chars → prompt_too_large", async () => {
  const { d } = deps();
  assert.equal((await (await handleSample(req({}), d)).json()).code, "upstream_error");
  const big = await handleSample(req({ prompt: "x".repeat(200_001) }), d);
  assert.equal(big.status, 400);
  assert.equal((await big.json()).code, "prompt_too_large");
});

test("daily cap reached → one rate_limited line, DeepSeek never called", async () => {
  const { d, seen } = deps({ spentToday: async () => 3 });
  const r = await handleSample(req({ prompt: "x" }), d);
  assert.equal(r.headers.get("content-type"), "application/x-ndjson; charset=utf-8");
  assert.deepEqual(await lines(r), [{ type: "error", code: "rate_limited", message: "今天的用量到上限了，明天再试" }]);
  assert.equal(seen.deepseekCalls, 0);
});

test("usage table unreadable → error line, DeepSeek never called (no spending blind)", async () => {
  const { d, seen } = deps({ spentToday: async () => { throw new Error("db down"); } });
  const out = await lines(await handleSample(req({ prompt: "x" }), d));
  assert.equal(out.at(-1).code, "upstream_error");
  assert.equal(seen.deepseekCalls, 0);
});

test("normal answer streams progress then result; usage recorded once", async () => {
  const { d, seen } = deps();
  const out = await lines(await handleSample(req({ prompt: "x" }), d));
  assert.deepEqual(out, [{ type: "progress", delta: '{"plan":1}' }, { type: "result", data: { plan: 1 } }]);
  assert.deepEqual(seen.usage, [["u1", "deepseek-flash", 50, 10]]);
});

test("upstream failure is the last line and usage is still recorded", async () => {
  const { d, seen } = deps({ chunks: answer("   ", 7, 3) });
  const out = await lines(await handleSample(req({ prompt: "x" }), d));
  assert.equal(out.at(-1).code, "invalid_json");
  assert.deepEqual(seen.usage, [["u1", "deepseek-flash", 7, 3]]);
});

test("client abort aborts the DeepSeek request", async () => {
  const ctl = new AbortController();
  const { d, seen } = deps({ waitForAbort: true });
  const r = await handleSample(req({ prompt: "x" }, "good", ctl.signal), d);
  const body = r.text();
  setTimeout(() => ctl.abort(), 20);
  await body.catch(() => "");
  assert.equal(seen.signal?.aborted, true);
});
