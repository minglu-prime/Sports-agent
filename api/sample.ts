import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { handleSample, spentEuro } from "../lib/sample-handler.ts";
import { readEnv } from "../lib/env.ts";

/** POST /api/sample: wires the real Supabase and DeepSeek clients into lib/sample-handler.ts. */
export async function POST(req: Request): Promise<Response> {
  const r = readEnv(["DEEPSEEK_API_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (!r.ok) return Response.json({ code: "upstream_error", message: `服务器没配置 ${r.missing}` }, { status: 500 });
  const { env } = r;
  const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const svc = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const today = () => new Date().toISOString().slice(0, 10); // UTC day, same as add_usage()
  return handleSample(req, {
    model,
    effort: process.env.DEEPSEEK_REASONING_EFFORT || "high",
    capEuro: Number(process.env.DAILY_EURO_CAP || 3),
    userId: async (token) => {
      const { data, error } = await anon.auth.getUser(token);
      if (error) console.warn("token rejected", error.message);
      return data.user?.id ?? null;
    },
    spentToday: async (owner) => {
      const { data, error } = await svc.from("usage").select("input_tokens,output_tokens").eq("owner", owner).eq("day", today()).maybeSingle();
      if (error) throw error;
      return spentEuro(model, data);
    },
    addUsage: async (owner, _m, inTok, outTok) => {
      const { error } = await svc.rpc("add_usage", { p_owner: owner, p_in: inTok, p_out: outTok });
      if (error) throw error;
    },
    deepseek: new OpenAI({ baseURL: "https://api.deepseek.com", apiKey: env.DEEPSEEK_API_KEY }),
  });
}
