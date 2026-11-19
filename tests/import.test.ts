import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain .mjs script without type declarations
import { rowsFromExport, countByKind } from "../scripts/import-artifact.mjs";

/** An export laid out like ArtifactData's out_dir: data/users/me/<id>.json, data/users/me/<tid>/msgs/<id>.json */
function exportDir() {
  const dir = mkdtempSync(join(tmpdir(), "u12-export-"));
  const me = join(dir, "data", "users", "me");
  mkdirSync(join(me, "t_abc", "msgs"), { recursive: true });
  writeFileSync(join(me, "t_abc.json"), JSON.stringify({ kind: "thread", title: "练快攻", createdAt: "2026-11-14T20:30:15Z", updatedAt: "2026-11-14T20:52:46Z" }));
  writeFileSync(join(me, "h_t_abc_m1.json"), JSON.stringify({ kind: "held", ts: "2026-11-14T20:31:00Z", tid: "t_abc", plan: { phasen: [] } }));
  writeFileSync(join(me, "lib_3mlqtw.json"), JSON.stringify({ kind: "lib", name: "头胸球", rating: "up", phase: "aktivierung", ts: "2026-11-15", drill: { name: "头胸球" } }));
  writeFileSync(join(me, "t_abc", "msgs", "m1.json"), JSON.stringify({ role: "agent", ts: "2026-11-14T20:31:00Z", text: "好了", plan: { titel: "x", phasen: [] } }));
  return dir;
}

test("export becomes one row per doc, keeping the Artifact ids and collections", () => {
  const rows = rowsFromExport(exportDir(), "owner-uuid");
  const key = (r: { coll: string; id: string }) => `${r.coll}|${r.id}`;
  assert.deepEqual(rows.map(key).sort(), ["t_abc/msgs|m1", "|h_t_abc_m1", "|lib_3mlqtw", "|t_abc"]);
  assert.ok(rows.every((r: { owner: string }) => r.owner === "owner-uuid"));
  assert.equal(rows.find((r: { id: string }) => r.id === "m1").data.text, "好了");
});

test("a second run produces the same keys, so the upsert adds nothing", () => {
  const dir = exportDir();
  const a = rowsFromExport(dir, "o").map((r: { coll: string; id: string }) => r.coll + r.id);
  const b = rowsFromExport(dir, "o").map((r: { coll: string; id: string }) => r.coll + r.id);
  assert.deepEqual(a.sort(), b.sort());
});

test("counts per kind, for checking against the export", () => {
  assert.deepEqual(countByKind(rowsFromExport(exportDir(), "o")), { thread: 1, held: 1, lib: 1, message: 1 });
});

test("a missing export folder is an error, not an empty import", () => {
  assert.throws(() => rowsFromExport(join(tmpdir(), "does-not-exist-u12"), "o"), /data[\\/]users[\\/]me/);
});
