# Architecture note

## What I prioritized and why

The brief asks for depth in a few areas over shallow coverage. I spent the time on the parts a reviewer can break by poking at them:

1. **Access control that holds up.** Sharing is only meaningful if it's enforced on the server. Every data function in `lib/documents.ts` takes the acting user and checks their role itself, so a route handler can't forget a check. The permission rules are pure functions (`lib/access.ts`), tested as a full matrix.
2. **Saves that don't lose work.** Autosave with a debounce, one request at a time (edits made during a save are sent next), a visible save status, a warning when leaving with unsaved changes, and **optimistic concurrency**: each document has a `version`, and a save based on an old version gets `409 Conflict` instead of silently overwriting another person's edits.
3. **Safe rich text.** Documents are stored as HTML, and HTML from the browser or from uploaded files is untrusted. Everything is passed through an allowlist sanitizer on write (`lib/sanitize.ts`) that only keeps what the editor itself can produce.
4. **A coherent editing experience.** Tiptap toolbar with active-state buttons, keyboard shortcuts, inline title rename, and a read-only mode for viewers.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript) | One repo and one deploy for UI and API. Server components read the DB directly for list and editor pages. |
| Editor | Tiptap 3 (ProseMirror) | A solid rich-text foundation. Its schema also drops unknown markup when loading. |
| DB | Postgres on Neon (`pg`) | Relational data (users, documents, shares) with a free tier reviewers don't pay for. Plain SQL with no ORM keeps the queries visible. |
| Hosting | Vercel | Zero-config Next.js hosting in the same region as the database. |
| Tests | Vitest | Fast. Runs both unit tests and integration tests against a real Postgres. |

## Data model

```
users(id, name, email)
documents(id uuid, title, content html, owner_id → users, version int, created_at, updated_at)
document_shares(document_id → documents ON DELETE CASCADE, user_id → users, role 'viewer'|'editor', PK(document_id, user_id))
```

The role is derived, not stored: `owner` if `owner_id` matches the user, else the share row's role, else no access. Users without access get a **404** rather than a 403, so the app doesn't reveal that a document exists.

## Key decisions and tradeoffs

| Decision | Tradeoff |
|---|---|
| **Store HTML, not Tiptap JSON** | Imports become simple (every format converts to HTML) and Markdown export is a single library call. Cost: HTML must be sanitized, which is done on every write. |
| **Mock auth: pick a seeded user, signed cookie** | The brief allows mocked auth. I used the time for sharing logic instead. The HMAC signature means the cookie can't be edited to become another user. Not production auth: there are no passwords and no sign-up. |
| **Upload = import as a new document** | The most product-relevant behavior for a document editor. `.docx` uses `mammoth`, `.md` uses `marked`, `.txt` is split into paragraphs. Size is limited to 2 MB, checked on both client and server. Attachments were cut. |
| **Last-write-wins replaced by 409 conflicts, not real-time merge** | Real-time co-editing (CRDT/Yjs plus a WebSocket server) is the right long-term answer but too much for the timebox. Conflict detection prevents silent data loss at a fraction of the cost. |
| **Route handlers + `fetch` for mutations** | Easy to test with curl, return clear error codes (400/401/403/404/409/413), and keep the client autosave logic explicit. Login and logout use server actions. |

## Deliberately cut

- Real-time collaboration and presence indicators
- Comments and suggestion mode
- Version history (the `version` column is a first step)
- Real authentication (OAuth/passwords), and sharing with people who aren't registered
- File attachments, images and tables in documents
- Delete button in the UI (the API exists and is tested; the UI was left out to keep the demo safe)

## What I'd build next (2–4 hours)

1. **Version history:** a `document_revisions` table written on save (throttled), with a "restore" view. The version column already makes this simple.
2. **Real-time co-editing:** Yjs with Tiptap's collaboration extension, plus presence avatars.
3. **Real auth:** e.g. Auth.js or Clerk, plus share invites for emails that haven't signed up yet.
4. **Browser end-to-end tests** (Playwright) for the share flow, plus a delete/trash UI.
