// One-off import of a coach's Artifact history into Supabase.
// node scripts/import-artifact.mjs <exportDir> <ownerUuid>   (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
// <exportDir> is an ArtifactData out_dir: data/users/me/<id>.json and data/users/me/<tid>/msgs/<id>.json.
// Upserts on (owner, coll, id) with the Artifact ids, so running it twice changes nothing.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Rows for the docs table: root docs get coll "", messages get coll "<tid>/msgs". */
export function rowsFromExport(dir, owner) {
  const me = join(dir, "data", "users", "me");
  if (!existsSync(me)) throw new Error(`no export at ${me} (expected data/users/me inside the export folder)`);
  const rows = [];
  const read = (file) => JSON.parse(readFileSync(file, "utf8"));
  for (const name of readdirSync(me)) {
    const p = join(me, name);
    if (name.endsWith(".json")) rows.push({ owner, coll: "", id: name.slice(0, -5), data: read(p) });
    else if (statSync(p).isDirectory() && existsSync(join(p, "msgs"))) {
      for (const m of readdirSync(join(p, "msgs")).filter((f) => f.endsWith(".json"))) {
        rows.push({ owner, coll: `${name}/msgs`, id: m.slice(0, -5), data: read(join(p, "msgs", m)) });
      }
    }
  }
  return rows;
}

export function countByKind(rows) {
  const out = {};
  for (const r of rows) { const k = r.coll ? "message" : r.data.kind || "other"; out[k] = (out[k] || 0) + 1; }
  return out;
}

async function main([dir, owner]) {
  if (!dir || !owner) throw new Error("usage: node scripts/import-artifact.mjs <exportDir> <ownerUuid>");
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error("set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const rows = rowsFromExport(dir, owner);
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db.from("docs").upsert(rows.slice(i, i + 100));
    if (error) throw new Error(`upsert failed at row ${i}: ${error.message}`);
  }
  const { count, error } = await db.from("docs").select("id", { count: "exact", head: true }).eq("owner", owner);
  if (error) throw new Error(`count failed: ${error.message}`);
  console.log("imported", countByKind(rows), `— rows for this owner now: ${count}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
