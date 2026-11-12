// Applies scripts/schema.sql to DATABASE_URL and gives the demo users a password. Safe to run repeatedly.
import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

export const DEMO_PASSWORD = 'demo-password';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

// Same format as lib/password.ts: scrypt$<salt>$<hash>
function hash(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${scryptSync(password, salt, 64).toString('base64url')}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
for (const id of ['u_alice', 'u_bob', 'u_carol']) {
  await client.query('update users set password_hash = $2 where id = $1 and password_hash is null', [id, hash(DEMO_PASSWORD)]);
}
await client.end();
console.log(`Database ready (schema applied, demo users seeded with password "${DEMO_PASSWORD}").`);
