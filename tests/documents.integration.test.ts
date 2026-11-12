// End-to-end check of the sharing + persistence rules against a real Postgres.
// Runs when DATABASE_URL is set (npm test loads .env.local); skipped otherwise.
import { afterAll, describe, expect, it } from 'vitest';
import * as docs from '@/lib/documents';
import { getPool } from '@/lib/db';

const hasDb = Boolean(process.env.DATABASE_URL);

const alice = { id: 'u_alice', name: 'Alice Johnson', email: 'alice@example.com' };
const bob = { id: 'u_bob', name: 'Bob Smith', email: 'bob@example.com' };
const carol = { id: 'u_carol', name: 'Carol Lee', email: 'carol@example.com' };

// Generous timeout: each test makes dozens of round trips to a remote database.
describe.skipIf(!hasDb)('documents service (Postgres)', { timeout: 60_000 }, () => {
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) await getPool().query('delete from documents where id = any($1)', [created]);
    await getPool().end();
  });

  it('owner creates, shares as viewer, upgrades to editor; access is enforced at each step', async () => {
    const id = await docs.createDocument(alice, 'Integration test doc', '<p>hello <script>x</script></p>');
    created.push(id);

    // Content is sanitized on write.
    const own = await docs.getDocument(alice, id);
    expect(own.role).toBe('owner');
    expect(own.content).toBe('<p>hello </p>');

    // Bob has no access yet, and the doc looks like it doesn't exist.
    await expect(docs.getDocument(bob, id)).rejects.toMatchObject({ status: 404 });

    // Viewer can read but not write or reshare. Email lookup is case-insensitive.
    await docs.shareDocument(alice, id, 'BOB@example.com', 'viewer');
    expect((await docs.getDocument(bob, id)).role).toBe('viewer');
    await expect(
      docs.updateDocument(bob, id, { content: '<p>hack</p>', baseVersion: own.version }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(docs.shareDocument(bob, id, carol.email, 'editor')).rejects.toMatchObject({ status: 403 });

    // It shows under Bob's "Shared with me", not "My documents".
    const bobList = await docs.listDocuments(bob);
    expect(bobList.shared.map((d) => d.id)).toContain(id);
    expect(bobList.owned.map((d) => d.id)).not.toContain(id);

    // Upgrade to editor; Bob's edit persists and Alice sees it.
    await docs.shareDocument(alice, id, bob.email, 'editor');
    const saved = await docs.updateDocument(bob, id, { content: '<h1>Bob was here</h1>', baseVersion: own.version });
    expect(saved.version).toBe(own.version + 1);
    expect((await docs.getDocument(alice, id)).content).toBe('<h1>Bob was here</h1>');

    // Revoking removes access again.
    await docs.revokeShare(alice, id, bob.id);
    await expect(docs.getDocument(bob, id)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a stale save with 409 instead of overwriting', async () => {
    const id = await docs.createDocument(alice, 'Conflict test');
    created.push(id);
    const { version } = await docs.getDocument(alice, id);

    await docs.updateDocument(alice, id, { content: '<p>first</p>', baseVersion: version });
    await expect(
      docs.updateDocument(alice, id, { content: '<p>stale</p>', baseVersion: version }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await docs.getDocument(alice, id)).content).toBe('<p>first</p>');
  });

  it('version history: coalesces rapid saves per author, splits on a new author, and restores', async () => {
    const id = await docs.createDocument(alice, 'History test', '<p>v1</p>');
    created.push(id);
    await docs.shareDocument(alice, id, bob.email, 'editor');
    await docs.shareDocument(alice, id, carol.email, 'viewer');

    let v = (await docs.getDocument(alice, id)).version;
    v = (await docs.updateDocument(alice, id, { content: '<p>alice draft</p>', baseVersion: v })).version;
    v = (await docs.updateDocument(alice, id, { content: '<p>alice final</p>', baseVersion: v })).version;
    v = (await docs.updateDocument(bob, id, { content: '<p>bob edit</p>', baseVersion: v })).version;

    const revs = await docs.listRevisions(carol, id); // viewers can browse history
    expect(revs.map((r) => r.author_name)).toEqual(['Bob Smith', 'Alice Johnson']); // Alice's saves coalesced
    const aliceRev = await docs.getRevision(carol, id, revs[1].id);
    expect(aliceRev.content).toBe('<p>alice final</p>');

    // Viewers cannot restore; editors can, and restore requires the current version.
    await expect(docs.restoreRevision(carol, id, aliceRev.id, v)).rejects.toMatchObject({ status: 403 });
    await expect(docs.restoreRevision(bob, id, aliceRev.id, v - 1)).rejects.toMatchObject({ status: 409 });
    const restored = await docs.restoreRevision(bob, id, aliceRev.id, v);
    expect(restored.content).toBe('<p>alice final</p>');
    expect((await docs.getDocument(alice, id)).content).toBe('<p>alice final</p>');

    // Revisions of other documents are not reachable through this one.
    const other = await docs.createDocument(carol, 'Carol private');
    created.push(other);
    const [carolRev] = await docs.listRevisions(carol, other);
    await expect(docs.getRevision(bob, id, carolRev.id)).rejects.toMatchObject({ status: 404 });
  });

  it('presence: heartbeats show who else is here, and leaving or losing access removes them', async () => {
    const id = await docs.createDocument(alice, 'Presence test');
    created.push(id);
    await docs.shareDocument(alice, id, bob.email, 'viewer');

    await docs.heartbeat(bob, id);
    const seenByAlice = await docs.heartbeat(alice, id);
    expect(seenByAlice.active).toEqual([{ user_id: 'u_bob', name: 'Bob Smith', role: 'viewer' }]);
    expect((await docs.heartbeat(bob, id)).active.map((p) => p.user_id)).toEqual(['u_alice']);

    await docs.leaveDocument(bob, id);
    expect((await docs.heartbeat(alice, id)).active).toEqual([]);

    await docs.heartbeat(bob, id);
    await docs.revokeShare(alice, id, bob.id);
    expect((await docs.heartbeat(alice, id)).active).toEqual([]); // revoked users drop off immediately
    await expect(docs.heartbeat(carol, id)).rejects.toMatchObject({ status: 404 }); // no access, no presence
  });

  it('only the owner can delete', async () => {
    const id = await docs.createDocument(alice, 'Delete test');
    created.push(id);
    await docs.shareDocument(alice, id, bob.email, 'editor');
    await expect(docs.deleteDocument(bob, id)).rejects.toMatchObject({ status: 403 });
    await docs.deleteDocument(alice, id);
    await expect(docs.getDocument(alice, id)).rejects.toMatchObject({ status: 404 });
  });
});
