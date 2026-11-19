import type OpenAI from "openai";
import { askJson, type PageEvent } from "./deepseek.ts";
import { euros, overCap } from "./cost.ts";

export type SampleDeps = {
  model: string;
  effort: string;
  capEuro: number;
  userId: (token: string) => Promise<string | null>;
  spentToday: (owner: string) => Promise<number>;
  addUsage: (owner: string, model: string, inputTokens: number, outputTokens: number) => Promise<void>;
  deepseek: OpenAI;
};

const MAX_PROMPT = 200_000; // chars; the page's longest prompts are ~15 000
const json = (status: number, code: string, message: string) => Response.json({ code, message }, { status });

/** POST /api/sample: login → cap → DeepSeek, answered as NDJSON page events (see lib/deepseek.ts). */
export async function handleSample(req: Request, d: SampleDeps): Promise<Response> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const owner = token ? await d.userId(token) : null;
  if (!owner) return json(401, "not_granted", "请先登录");

  let prompt: unknown;
  try { prompt = ((await req.json()) as { prompt?: unknown }).prompt; }
  catch { return json(400, "upstream_error", "请求格式不对"); }
  if (typeof prompt !== "string" || !prompt.trim()) return json(400, "upstream_error", "请求里没有内容");
  if (prompt.length > MAX_PROMPT) return json(400, "prompt_too_large", "内容太长");

  const ctl = new AbortController();
  req.signal.addEventListener("abort", () => ctl.abort(), { once: true });
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const send = (e: PageEvent) => out.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        let spent: number;
        try { spent = await d.spentToday(owner); }
        catch (e) {
          console.error("usage read failed", e);
          send({ type: "error", code: "upstream_error", message: "用量记录读取失败，稍后再试" });
          return;
        }
        if (overCap(spent, d.capEuro)) { send({ type: "error", code: "rate_limited", message: "今天的用量到上限了，明天再试" }); return; }

        const gen = askJson(d.deepseek, { model: d.model, effort: d.effort, prompt: prompt as string, signal: ctl.signal });
        let r = await gen.next();
        while (!r.done) { send(r.value); r = await gen.next(); }
        try { await d.addUsage(owner, d.model, r.value.inputTokens, r.value.outputTokens); }
        catch (e) { console.error("usage not recorded", { owner, model: d.model, ...r.value }, e); }
      } catch (e) {
        console.error("sample stream failed", e); // the client may be gone already; nothing more to tell it
      } finally {
        try { out.close(); } catch (e) { console.warn("stream already closed", e); }
      }
    },
    cancel() { ctl.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

/** Euro spend for a day's stored token counts, priced with the model now configured. */
export const spentEuro = (model: string, row: { input_tokens: number; output_tokens: number } | null): number =>
  row ? euros(model, row.input_tokens, row.output_tokens) : 0;
