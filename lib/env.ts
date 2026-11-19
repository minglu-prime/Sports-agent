/** Reads required env vars; returns the first missing name instead of throwing, so the endpoint can say which one. */
export function readEnv<K extends string>(names: K[]): { ok: true; env: Record<K, string> } | { ok: false; missing: K } {
  const env = {} as Record<K, string>;
  for (const n of names) {
    const v = process.env[n];
    if (!v) return { ok: false, missing: n };
    env[n] = v;
  }
  return { ok: true, env };
}

/** Supabase settings under every name in use: classic keys, the newer publishable/secret keys, and the
 *  NEXT_PUBLIC_* names Supabase's Vercel integration creates. The first name set wins. */
export const SUPABASE_ENV = {
  url: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  publicKey: ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  secretKey: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"],
} as const;

export function pickEnv<K extends string>(
  spec: Record<K, readonly string[]>,
  source: Record<string, string | undefined> = process.env,
): { ok: true; env: Record<K, string> } | { ok: false; missing: string } {
  const env = {} as Record<K, string>;
  for (const key of Object.keys(spec) as K[]) {
    const name = spec[key].find((n) => source[n]);
    if (!name) return { ok: false, missing: spec[key].join(" / ") };
    const value = source[name] as string;
    // the Supabase dashboard also shows the REST endpoint (…/rest/v1/); clients need the bare project URL
    env[key] = key === "url" ? value.trim().replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "") : value.trim();
  }
  return { ok: true, env };
}
