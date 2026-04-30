import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export { schema };

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Lazily-initialised Drizzle client. Use only in server code that needs to bypass RLS
 * (admin operations, migrations). Application reads/writes should go through the
 * Supabase JS client so Postgres RLS policies are enforced.
 */
export function db() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    const sql = postgres(process.env.DATABASE_URL, { prepare: false });
    _db = drizzle(sql, { schema });
  }
  return _db;
}
