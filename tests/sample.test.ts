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

// Review finding I3a: when the coach leaves, the stream is cancelled; usage must still be recorded.
test("client disconnect mid-answer still records usage, through keepAlive", async () => {
  const kept: Promise<unknown>[] = [];
  const { d, seen } = deps({ waitForAbort: true, keepAlive: (p) => { kept.push(p); } });
  const r = await handleSample(req({ prompt: "x".repeat(40) }), d);
  const reader = r.body!.getReader();
  setTimeout(() => reader.cancel(), 20);
  await reader.read().catch(() => undefined);
  await new Promise((res) => setTimeout(res, 50));
  await Promise.all(kept);
  assert.equal(kept.length, 1);
  assert.equal(seen.usage.length, 1);
  assert.equal(seen.usage[0][2], 40, "prompt counted even though DeepSeek never reported usage");
});

// Review finding I4: a Supabase hiccup is not a logged-out coach.
test("login service failure → 503 upstream_error, not 401", async () => {
  const { d, seen } = deps({ userId: async () => { throw new Error("fetch failed"); } });
  const r = await handleSample(req({ prompt: "x" }), d);
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { code: "upstream_error", message: "登录服务暂时连不上，稍后再试" });
  assert.equal(seen.deepseekCalls, 0);
});

// Go-live finding: with thinking on, each court picture took ~25 s (9 pictures ≈ 4 min). Pictures use the light effort.
test("a light request runs with the light effort; a normal one keeps the configured effort", async () => {
  const bodies: Record<string, unknown>[] = [];
  const mk = () => {
    const { d } = deps();
    const create = d.deepseek.chat.completions.create.bind(d.deepseek.chat.completions) as (b: unknown, o?: unknown) => Promise<unknown>;
    (d.deepseek.chat.completions as unknown as { create: unknown }).create = async (b: Record<string, unknown>, o?: unknown) => { bodies.push(b); return create(b, o); };
    return { ...d, lightEffort: "none" };
  };
  await (await handleSample(req({ prompt: "x", light: true }), mk())).text();
  await (await handleSample(req({ prompt: "x" }), mk())).text();
  assert.deepEqual(bodies.map((b) => [b.reasoning_effort, (b.thinking as { type: string }).type]), [["none", "disabled"], ["high", "enabled"]]);
});
