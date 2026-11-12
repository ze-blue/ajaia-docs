// Resets the database to a clean demo state for reviewers:
// deletes ALL documents, then creates a few that show owned vs shared and editor vs viewer.
// Usage: npm run db:seed-demo
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const docs = [
  {
    owner: 'u_alice',
    title: 'Welcome to Ajaia Docs',
    content:
      '<h1>Welcome to Ajaia Docs</h1>' +
      '<p>This document is owned by <strong>Alice</strong> and shared with <strong>Bob as an editor</strong> and <strong>Carol as a viewer</strong>.</p>' +
      '<h2>Things to try</h2>' +
      '<ol><li><p>Format text with <strong>bold</strong>, <em>italic</em>, <u>underline</u>, headings and lists.</p></li>' +
      '<li><p>Click <strong>Share</strong> to change who has access.</p></li>' +
      '<li><p>Sign in as Carol: this document opens read-only.</p></li>' +
      '<li><p>Import a .txt, .md or .docx file from the home page.</p></li></ol>',
    shares: [['u_bob', 'editor'], ['u_carol', 'viewer']],
  },
  {
    owner: 'u_bob',
    title: 'Q4 launch checklist',
    content:
      '<h2>Q4 launch checklist</h2>' +
      '<p>Owned by Bob, shared with Alice as a <em>viewer</em>.</p>' +
      '<ul><li><p>Finalize pricing page</p></li><li><p>QA the onboarding flow</p></li><li><p>Announce in #general</p></li></ul>',
    shares: [['u_alice', 'viewer']],
  },
  {
    owner: 'u_carol',
    title: 'Private notes',
    content: '<p>Only Carol can see this one. It is not shared with anyone.</p>',
    shares: [],
  },
];

await client.query('begin');
await client.query('delete from documents');
for (const d of docs) {
  const { rows } = await client.query(
    'insert into documents (title, content, owner_id) values ($1, $2, $3) returning id',
    [d.title, d.content, d.owner],
  );
  for (const [userId, role] of d.shares) {
    await client.query('insert into document_shares (document_id, user_id, role) values ($1, $2, $3)', [rows[0].id, userId, role]);
  }
}
await client.query('commit');
await client.end();
console.log(`Demo data reset: ${docs.length} documents.`);
