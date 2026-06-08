import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

/**
 * Load apps/web/.env.local into process.env WITHOUT printing any values.
 * Playwright's webServer (next dev) loads .env.local itself, but the
 * global-setup seed + the spec's cleanup client run in Node and need the
 * Supabase URL + service-role key too. Existing env vars are never
 * overwritten. Never log the parsed values.
 */
export function loadEnv() {
  if (loaded) return;
  loaded = true;

  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), 'apps', 'web', '.env.local'),
    resolve(__dirname, '..', '.env.local'),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return;

  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!.trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
