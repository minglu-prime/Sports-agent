import { test } from "node:test";
import assert from "node:assert/strict";
import { pickEnv, SUPABASE_ENV } from "../lib/env.ts";

// Go-live finding: Supabase now issues publishable/secret keys, and its Vercel integration names variables
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY; the server only read SUPABASE_URL & co.
test("new Supabase key names and integration names are accepted", () => {
  const r = pickEnv(SUPABASE_ENV, { NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x", SUPABASE_SECRET_KEY: "sb_secret_y" });
  assert.deepEqual(r, { ok: true, env: { url: "https://p.supabase.co", publicKey: "sb_publishable_x", secretKey: "sb_secret_y" } });
});

test("classic names still work and win over aliases", () => {
  const r = pickEnv(SUPABASE_ENV, { SUPABASE_URL: "a", NEXT_PUBLIC_SUPABASE_URL: "b", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "svc" });
  assert.deepEqual(r, { ok: true, env: { url: "a", publicKey: "anon", secretKey: "svc" } });
});

test("missing value names every accepted variable", () => {
  const r = pickEnv(SUPABASE_ENV, { SUPABASE_URL: "a" });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.missing, "SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY");
});

// Go-live finding: the dashboard's "Data API" page shows https://<ref>.supabase.co/rest/v1/ and that got pasted as the URL.
test("a pasted REST endpoint is reduced to the project URL", () => {
  const r = pickEnv(SUPABASE_ENV, { SUPABASE_URL: "https://abc.supabase.co/rest/v1/", SUPABASE_ANON_KEY: "a", SUPABASE_SECRET_KEY: "s" });
  assert.equal(r.ok && r.env.url, "https://abc.supabase.co");
  const plain = pickEnv(SUPABASE_ENV, { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SECRET_KEY: "s" });
  assert.equal(plain.ok && plain.env.url, "https://abc.supabase.co");
});
