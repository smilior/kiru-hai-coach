/**
 * Apply sql/schema.sql to Turso.
 * Usage: node --env-file=.env.local scripts/migrate.mjs
 * Or set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in the environment.
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const sqlPath = resolve(__dirname, "../sql/schema.sql");
const raw = readFileSync(sqlPath, "utf8");
const statements = raw
  .split(";")
  .map((s) => s.replace(/--[^\n]*/g, "").trim())
  .filter(Boolean);

const db = createClient({ url, authToken });
for (const stmt of statements) {
  console.log(">", stmt.slice(0, 60).replace(/\s+/g, " "), "...");
  await db.execute(stmt);
}
console.log("Migration OK");
