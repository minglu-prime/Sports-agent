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
