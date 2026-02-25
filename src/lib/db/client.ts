import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Turso libSQL client — reads from environment variables.
// In development: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env.local
// Provider config (admin UI) never touches these credentials directly.

const authToken = process.env.TURSO_AUTH_TOKEN;
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  ...(authToken ? { authToken } : {}),
});

export const db = drizzle(turso, { schema });
