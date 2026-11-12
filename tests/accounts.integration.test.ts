// Sign-up and sign-in against a real Postgres. Runs when DATABASE_URL is set; skipped otherwise.
import { afterAll, describe, expect, it } from 'vitest';
import { authenticate, createAccount } from '@/lib/accounts';
import { getPool } from '@/lib/db';
import { shareDocument, createDocument, getDocument } from '@/lib/documents';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('accounts (Postgres)', { timeout: 60_000 }, () => {
  const email = `test-${Date.now()}@example.com`;
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await getPool().query('delete from documents where owner_id = any($1)', [created]);
      await getPool().query('delete from document_shares where user_id = any($1)', [created]);
      await getPool().query('delete from document_presence where user_id = any($1)', [created]);
      await getPool().query('delete from users where id = any($1)', [created]);
    }
    await getPool().end();
  });

  it('signs up, rejects duplicates, and signs in only with the right password', async () => {
    const user = await createAccount({ name: 'Test Person', email: email.toUpperCase(), password: 'long-enough-pw' });
    created.push(user.id);
    expect(user.email).toBe(email); // normalized to lower case

    await expect(createAccount({ name: 'Again', email, password: 'long-enough-pw' })).rejects.toMatchObject({ status: 409 });
    await expect(createAccount({ name: 'Short', email: `x${email}`, password: 'short' })).rejects.toThrow(/at least 8/);

    expect(await authenticate({ email, password: 'long-enough-pw' })).toEqual(user);
    expect(await authenticate({ email: email.toUpperCase(), password: 'long-enough-pw' })).toEqual(user);
    expect(await authenticate({ email, password: 'wrong-password' })).toBeNull();
    expect(await authenticate({ email: 'nobody@example.com', password: 'long-enough-pw' })).toBeNull();
  });

  it('demo accounts sign in with the documented password', async () => {
    expect(await authenticate({ email: 'alice@example.com', password: 'demo-password' })).toMatchObject({ id: 'u_alice' });
  });

  it('a new account can be shared with by email', async () => {
    const user = { id: created[0], name: 'Test Person', email };
    const alice = { id: 'u_alice', name: 'Alice Johnson', email: 'alice@example.com' };
    const id = await createDocument(alice, 'Shared with a new account');
    try {
      await shareDocument(alice, id, email, 'viewer');
      expect((await getDocument(user, id)).role).toBe('viewer');
    } finally {
      await getPool().query('delete from documents where id = $1', [id]);
    }
  });
});
