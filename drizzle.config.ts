import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local (Next.js convention) so drizzle-kit picks up the same env vars as the app.
// Falls back to .env if .env.local doesn't exist.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    ...(process.env.TURSO_AUTH_TOKEN ? { authToken: process.env.TURSO_AUTH_TOKEN } : {}),
  },
});
