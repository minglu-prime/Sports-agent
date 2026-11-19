import { pickEnv, SUPABASE_ENV } from "../lib/env.ts";

/** GET /api/config: the public Supabase settings the browser needs (the public key is public by design; RLS protects the data). */
export function GET(): Response {
  const r = pickEnv({ url: SUPABASE_ENV.url, publicKey: SUPABASE_ENV.publicKey });
  if (!r.ok) return Response.json({ code: "upstream_error", message: `服务器没配置 ${r.missing}` }, { status: 500 });
  return Response.json({ supabaseUrl: r.env.url, supabaseAnonKey: r.env.publicKey }, { headers: { "cache-control": "no-store" } });
}
