#!/usr/bin/env node
/**
 * Apply a specific Supabase SQL migration file to the configured Postgres URL.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local packages/db/scripts/apply-migration.mjs 0003
 *
 * Looks up migrations in packages/db/supabase/migrations/. Picks the file whose
 * basename starts with the given prefix.
 *
 * Connects via POSTGRES_URL_NON_POOLING (session connection — required for DDL)
 * with fallback to DATABASE_URL.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(__dirname, '..', 'supabase', 'migrations');

const prefix = process.argv[2];
if (!prefix) {
  console.error('Usage: apply-migration.mjs <prefix>  e.g. 0003');
  process.exit(1);
}

const candidates = readdirSync(migrationsDir).filter(
  (f) => f.startsWith(prefix) && f.endsWith('.sql'),
);
if (candidates.length === 0) {
  console.error(`No migration in ${migrationsDir} matching "${prefix}*.sql"`);
  process.exit(1);
}
if (candidates.length > 1) {
  console.error(`Ambiguous prefix "${prefix}", matches: ${candidates.join(', ')}`);
  process.exit(1);
}

const file = join(migrationsDir, candidates[0]);
const sql = readFileSync(file, 'utf8');

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.error('POSTGRES_URL_NON_POOLING or DATABASE_URL must be set');
  process.exit(1);
}

console.log(`→ Applying ${candidates[0]}`);
console.log(`  Host: ${new URL(url).hostname}`);

const client = postgres(url, { prepare: false, ssl: 'require' });

try {
  // postgres-js can run multi-statement scripts via .unsafe()
  await client.unsafe(sql);
  console.log(`✓ ${candidates[0]} applied successfully`);
} catch (err) {
  console.error(`✗ Migration failed:`);
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
