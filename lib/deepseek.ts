import type OpenAI from "openai";
import { APIError, APIUserAbortError } from "openai";

/** What the page receives, one per NDJSON line. Error codes are the ones the page already translates (ERR_COPY). */
export type PageEvent =
  | { type: "progress"; delta: string }
  | { type: "result"; data: unknown }
  | { type: "error"; code: string; message: string };

export type Usage = { inputTokens: number; outputTokens: number };

/** DeepSeek HTTP status → page error (api-docs.deepseek.com/quick_start/error_codes). */
export function mapError(e: unknown): { code: string; message: string } {
  if (e instanceof APIUserAbortError || (e instanceof Error && e.name === "AbortError")) return { code: "cancelled", message: "已停止" };
  if (e instanceof APIError && typeof e.status === "number") {
    const body = e.error as { message?: string } | undefined;
    const msg = body?.message || e.message || `DeepSeek ${e.status}`;
    if (e.status === 413 || /context length|too long|maximum context/i.test(msg)) return { code: "prompt_too_large", message: msg };
    if (e.status === 402) return { code: "upstream_error", message: "DeepSeek 余额不足" };
    if (e.status === 401) return { code: "upstream_error", message: "服务器的 DeepSeek 密钥无效" };
    if (e.status === 429 || e.status === 503) return { code: "rate_limited", message: "DeepSeek 现在太忙，稍后再试" };
    return { code: "upstream_error", message: msg };
  }
  return { code: "upstream_error", message: e instanceof Error ? e.message : String(e) };
}

/** Asks DeepSeek for a JSON answer, streaming. Yields progress (reasoning and answer text), then exactly one
 *  result or error; returns the token usage (zeros when the stream ended before DeepSeek reported it). */
export async function* askJson(
  client: OpenAI,
  opts: { model: string; effort: string; prompt: string; signal: AbortSignal },
): AsyncGenerator<PageEvent, Usage> {
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let answer = "";
  try {
    const body = {
      model: opts.model,
      messages: [{ role: "user" as const, content: opts.prompt }],
      response_format: { type: "json_object" as const },
      stream: true as const,
      stream_options: { include_usage: true },
      reasoning_effort: opts.effort as OpenAI.ReasoningEffort,
      thinking: { type: opts.effort === "none" ? "disabled" : "enabled" }, // DeepSeek extension, not in the OpenAI types
    };
    const stream = await client.chat.completions.create(body as OpenAI.ChatCompletionCreateParamsStreaming, { signal: opts.signal });
    for await (const c of stream) {
      if (c.usage) { usage.inputTokens = c.usage.prompt_tokens; usage.outputTokens = c.usage.completion_tokens; }
      const d = c.choices[0]?.delta as { content?: string | null; reasoning_content?: string | null } | undefined;
      if (d?.reasoning_content) yield { type: "progress", delta: d.reasoning_content };
      if (d?.content) { answer += d.content; yield { type: "progress", delta: d.content }; }
    }
  } catch (e) {
    yield { type: "error", ...mapError(e) };
    return usage;
  }
  // JSON mode may answer with only spaces (non-JSON output is blanked); that is a failed answer, not an empty plan
  if (!answer.trim()) { yield { type: "error", code: "invalid_json", message: "DeepSeek 返回了空白回答" }; return usage; }
  try { yield { type: "result", data: JSON.parse(answer) }; }
  catch { yield { type: "error", code: "invalid_json", message: "DeepSeek 的回答不是有效的 JSON" }; }
  return usage;
}
