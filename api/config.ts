import { readEnv } from "../lib/env.ts";

/** GET /api/config: the public Supabase settings the browser needs (the anon key is public by design; RLS protects the data). */
export function GET(): Response {
  const r = readEnv(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);
  if (!r.ok) return Response.json({ code: "upstream_error", message: `服务器没配置 ${r.missing}` }, { status: 500 });
  return Response.json({ supabaseUrl: r.env.SUPABASE_URL, supabaseAnonKey: r.env.SUPABASE_ANON_KEY }, { headers: { "cache-control": "no-store" } });
}
