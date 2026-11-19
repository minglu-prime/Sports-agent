import { test } from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { APIError, APIUserAbortError } from "openai";
import { askJson, mapError, type PageEvent } from "../lib/deepseek.ts";

type Chunk = { choices: { delta: { content?: string | null; reasoning_content?: string | null }; finish_reason: string | null }[]; usage?: { prompt_tokens: number; completion_tokens: number } | null };
const chunk = (content: string | null, reasoning: string | null = null, finish: string | null = null): Chunk => ({ choices: [{ delta: { content, reasoning_content: reasoning }, finish_reason: finish }], usage: null });
const usageChunk = (p: number, c: number): Chunk => ({ choices: [], usage: { prompt_tokens: p, completion_tokens: c } });

/** Fake DeepSeek client: create() records the request body and replays the given chunks (or throws mid-stream). */
function fakeClient(chunks: Chunk[], opts: { throwAt?: number; error?: unknown } = {}) {
  const calls: { body: Record<string, unknown>; signal?: AbortSignal }[] = [];
  const client = {
    chat: { completions: { create: async (body: Record<string, unknown>, o?: { signal?: AbortSignal }) => {
      calls.push({ body, signal: o?.signal });
      return (async function* () {
        for (let i = 0; i < chunks.length; i++) {
          if (opts.throwAt === i) throw opts.error;
          if (o?.signal?.aborted) throw new APIUserAbortError();
          yield chunks[i];
        }
      })();
    } } },
  };
  return { client: client as unknown as OpenAI, calls };
}

/** Runs the generator to the end; returns the events and the generator's return value. */
async function drain(gen: AsyncGenerator<PageEvent, { inputTokens: number; outputTokens: number }>) {
  const events: PageEvent[] = [];
  for (;;) {
    const r = await gen.next();
    if (r.done) return { events, usage: r.value };
    events.push(r.value);
  }
}
const opts = (signal = new AbortController().signal) => ({ model: "deepseek-flash", effort: "high", prompt: "只用JSON回答", signal });

test("streams reasoning and answer as progress, then the parsed JSON", async () => {
  const { client, calls } = fakeClient([chunk(null, "想一想"), chunk('{"a":'), chunk("1}", null, "stop"), usageChunk(100, 20)]);
  const { events, usage } = await drain(askJson(client, opts()));
  assert.deepEqual(events, [
    { type: "progress", delta: "想一想" },
    { type: "progress", delta: '{"a":' },
    { type: "progress", delta: "1}" },
    { type: "result", data: { a: 1 } },
  ]);
  assert.deepEqual(usage, { inputTokens: 100, outputTokens: 20 });
  const body = calls[0].body;
  assert.equal(body.model, "deepseek-flash");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.stream, true);
  assert.deepEqual(body.stream_options, { include_usage: true });
  assert.equal(body.reasoning_effort, "high");
  assert.deepEqual(body.thinking, { type: "enabled" });
  assert.deepEqual(body.messages, [{ role: "user", content: "只用JSON回答" }]);
});

test("effort none turns thinking off", async () => {
  const { client, calls } = fakeClient([chunk("{}", null, "stop")]);
  await drain(askJson(client, { ...opts(), effort: "none" }));
  assert.deepEqual(calls[0].body.thinking, { type: "disabled" });
});

test("blank JSON-mode answer (only spaces) is invalid_json, never an empty plan", async () => {
  // DeepSeek JSON mode replaces non-JSON output with spaces and still reports finish_reason "stop"
  const { client } = fakeClient([chunk("   ", null, "stop"), usageChunk(10, 5)]);
  const { events, usage } = await drain(askJson(client, opts()));
  assert.equal(events.at(-1)?.type, "error");
  assert.equal((events.at(-1) as { code: string }).code, "invalid_json");
  assert.deepEqual(usage, { inputTokens: 10, outputTokens: 5 });
});

test("unparsable answer is invalid_json", async () => {
  const { client } = fakeClient([chunk("not json", null, "stop")]);
  const { events } = await drain(askJson(client, opts()));
  assert.equal((events.at(-1) as { code: string }).code, "invalid_json");
});

test("upstream error mid-stream ends with a mapped error event", async () => {
  const { client } = fakeClient([chunk('{"a":'), chunk("1}")], { throwAt: 1, error: new APIError(503, { message: "overloaded" }, undefined, new Headers()) });
  const { events } = await drain(askJson(client, opts()));
  assert.deepEqual(events.at(-1), { type: "error", code: "rate_limited", message: "DeepSeek 现在太忙，稍后再试" });
});

test("abort mid-stream ends with cancelled", async () => {
  const ctl = new AbortController();
  const { client } = fakeClient([chunk('{"a":'), chunk("1}")]);
  const gen = askJson(client, opts(ctl.signal));
  assert.deepEqual((await gen.next()).value, { type: "progress", delta: '{"a":' });
  ctl.abort();
  const rest = await drain(gen);
  assert.equal((rest.events.at(-1) as { code: string }).code, "cancelled");
  assert.equal(typeof rest.usage.inputTokens, "number");
});

test("mapError covers DeepSeek's status codes", () => {
  // shaped like the SDK builds it from a DeepSeek error body: {"error": {"message": ...}}
  const e = (s: number, m = "m") => new APIError(s, { message: m }, undefined, new Headers());
  assert.deepEqual(mapError(e(402)), { code: "upstream_error", message: "DeepSeek 余额不足" });
  assert.equal(mapError(e(429)).code, "rate_limited");
  assert.equal(mapError(e(503)).code, "rate_limited");
  assert.deepEqual(mapError(e(400, "bad field")), { code: "upstream_error", message: "bad field" });
  assert.deepEqual(mapError(e(422, "bad param")), { code: "upstream_error", message: "bad param" });
  assert.equal(mapError(e(413)).code, "prompt_too_large");
  assert.equal(mapError(e(400, "This model's maximum context length is 1000000 tokens")).code, "prompt_too_large");
  assert.equal(mapError(e(401)).code, "upstream_error");
  assert.equal(mapError(new APIUserAbortError()).code, "cancelled");
  assert.equal(mapError(new Error("socket hang up")).code, "upstream_error");
});
