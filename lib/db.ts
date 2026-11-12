import { Pool } from 'pg';

// Reuse one pool across hot reloads in dev and across invocations on a warm serverless instance.
const g = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. See README → Local setup.');
  }
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
}

export function getPool(): Pool {
  if (!g.pgPool) g.pgPool = createPool();
  return g.pgPool;
}

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export const q: Query = async (text, params = []) => {
  const result = await getPool().query(text, params);
  return result.rows;
};

/** Runs `fn` inside BEGIN/COMMIT on one connection; rolls back if it throws. */
export async function withTransaction<T>(fn: (tx: Query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  const tx: Query = async (text, params = []) => (await client.query(text, params)).rows;
  try {
    await client.query('begin');
    const result = await fn(tx);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
