# Architecture note

## What I prioritized and why

The brief asks for depth in a few areas over shallow coverage. I spent the time on the parts a reviewer can break by poking at them, in this order:

1. **Access control that holds up.** Sharing is only meaningful if it's enforced on the server. Every data function in `lib/documents.ts` takes the acting user and checks their role itself, so a route handler can't forget a check. The permission rules are pure functions (`lib/access.ts`), tested as a full matrix.
2. **Saves that never lose work silently.** Autosave sends one request at a time (edits made during a save are sent next). The save status is always visible. Leaving the page, or navigating within the app, with unsaved changes asks first. **Optimistic concurrency:** each document has a `version`, and a save based on an old version gets `409 Conflict` instead of overwriting someone else's edits.
3. **Safe rich text.** HTML from the browser or from uploaded files is untrusted. Everything goes through an allowlist sanitizer on write (`lib/sanitize.ts`). Stored HTML is only ever displayed through Tiptap's schema, never through `innerHTML`.
4. **Collaboration that feels live, within the timebox.** Presence avatars, collaborators' saves arriving automatically, and version history. These are the parts of "collaborative" users notice most, without a real-time sync engine.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript) | One repo and one deploy for UI and API. Server components read the DB directly for list and editor pages, with `loading.tsx` boundaries as the Cache Components model requires. |
| Editor | Tiptap 3 (ProseMirror) | A solid rich-text foundation. Its schema also drops unknown markup when loading. |
| DB | Postgres on Neon (`pg`) | Relational data with a free tier reviewers don't pay for. Plain SQL with no ORM keeps the queries visible. Saves use transactions. |
| Hosting | Vercel | Zero-config Next.js hosting in the same region as the database: saves take about 0.3 s. |
| Tests | Vitest + Playwright | Unit tests, integration tests against real Postgres, and a multi-user browser test of the whole flow. CI on GitHub Actions. |

## Data model

```
users(id, name, email)
documents(id uuid, title, content html, owner_id → users, version int, updated_by → users, created_at, updated_at)
document_shares(document_id → documents CASCADE, user_id → users, role 'viewer'|'editor', PK(document_id, user_id))
document_revisions(id, document_id → documents CASCADE, version, title, content, created_by → users, created_at, updated_at)
document_presence(document_id → documents CASCADE, user_id → users, last_seen, PK(document_id, user_id))
```

The role is derived, not stored: `owner` if `owner_id` matches the user, else the share row's role, else no access. Users without access get a **404** rather than a 403, so the app doesn't reveal that a document exists.

## Key decisions and tradeoffs

| Decision | Tradeoff |
|---|---|
| **Store HTML, not Tiptap JSON** | Imports become simple (every format converts to HTML) and Markdown export is a single library call. Cost: HTML must be sanitized, which is done on every write. |
| **Email and password accounts, built in, no auth provider** | The brief allows mocked auth, and the first version used it. With time left I replaced it with real sign-up and sign-in: scrypt-hashed passwords, a signed session cookie that expires after 7 days, and a single error message for any failed sign-in. I avoided an external provider (Clerk, Auth0) so reviewers don't need to sign up anywhere or pay. One-click demo sign-in stays, limited to the three seeded accounts, so sharing can be tested quickly. Not included: password reset, email verification, rate limiting. |
| **Upload = import as a new document** | The most product-relevant behavior for a document editor. `.docx` uses `mammoth`, `.md` uses `marked`, `.txt` is split into paragraphs. 2 MB limit, checked on the client and the server, plus a check that the result is still small enough to edit. Attachments were cut. |
| **Polling heartbeat (every 5 s) instead of WebSockets** | Works on serverless hosting with no extra infrastructure, and one request serves presence and change detection together. Cost: updates arrive within about 5 s rather than instantly, and there's a small, steady load on the database. Fine for a team tool of this size. |
| **Pull whole saves, plus 409 conflicts, instead of real-time merge** | With no unsaved changes, a collaborator's save is pulled in automatically. Pulled content is kept out of undo history, so Ctrl+Z can't revert someone else's work. With unsaved changes, the user gets a warning instead of losing work. True character-level co-editing (Yjs/CRDT) is the next step. |
| **Revisions grouped per author per minute** | Autosave fires about once a second while typing. Storing every save would flood history; storing too few loses useful restore points. A new revision starts when a different person edits, after a minute, or on restore. A restore never overwrites the revision it replaces. |
| **Route handlers + `fetch` for mutations** | Easy to test with curl, return clear error codes (400/401/403/404/409/413), and keep the client autosave logic explicit. Login and logout use server actions. |

## Deliberately cut

- Character-level real-time co-editing and live cursors
- Comments and suggestion mode
- Password reset, email verification, sign-in rate limiting, and OAuth (each needs an email service, an external provider, or shared storage)
- Sharing with people who don't have an account yet
- File attachments, images and tables in documents
- Cleanup job for old presence rows (they're simply ignored after 20 s)

## What I'd build next (2–4 hours)

1. **Real-time co-editing:** Yjs with Tiptap's collaboration extension over a WebSocket provider (e.g. Hocuspocus or Liveblocks), adding live cursors. This replaces whole-document pulls and most 409s.
2. **Harden accounts:** rate limiting on sign-in, password reset by email, and share invites for emails that haven't signed up yet.
3. **Comments** anchored to text ranges, with resolve and notify.
4. **Revision diffs** (highlight what changed) and a trash with undo-delete.
