// Applies scripts/schema.sql to DATABASE_URL. Safe to run repeatedly.
import { readFileSync } from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('Database ready (schema applied, demo users seeded).');
