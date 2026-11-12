# Ajaia Docs

A lightweight collaborative document editor. You can create and format documents, import files, share them as editor or viewer, see who else is in a document, get collaborators' changes live, and restore earlier versions. Everything is saved to Postgres.

**Live app:** https://ajaia-docs-ten-gamma.vercel.app
**Demo accounts:** pick any of the three on the sign-in page (no password).

| User | Email |
|---|---|
| Alice Johnson | alice@example.com |
| Bob Smith | bob@example.com |
| Carol Lee | carol@example.com |

## Try it (3 minutes)

Open **two browser windows**: a normal one and a private/incognito one, so you can be two users at once.

1. **Window 1, as Alice:** click **+ New document**, give it a title, and type some formatted text (toolbar or Ctrl+B/I/U). The header shows "All changes saved".
2. Click **Share**, enter `bob@example.com`, choose **Can view**, and click **Share**.
3. **Window 2, as Bob:** the document is under **Shared with me**, labeled `Alice Johnson · viewer`. It opens read-only. Each window shows the other person's avatar.
4. **Type in Alice's window.** Within a few seconds Bob's window updates on its own and shows "Updated with changes from Alice Johnson".
5. As Alice, change Bob to **Editor**. Bob gets a banner asking him to reload, and then he can edit.
6. Click **History** to preview earlier versions and restore one.
7. Sign in as **Carol**: she can't open the document, even with its URL.

## Features

| Area | What works |
|---|---|
| Documents | Create, rename (inline title), edit, autosave (800 ms after you stop typing, or Ctrl+S), reopen, delete with confirmation (owner only), word count |
| Formatting | Bold, italic, underline, H1–H3, bulleted and numbered lists, block quote, undo/redo, keyboard shortcuts |
| File upload | **Import `.txt`, `.md`, `.docx` (max 2 MB)**, each becomes a new editable document titled after the file. Other types are rejected with a clear message. |
| Sharing | Owner shares by email as **editor** or **viewer**, changes a person's role, or removes access. Lists are split into **My documents** and **Shared with me**. |
| Collaboration | **Presence avatars** show who else has the document open and whether they're viewing or editing. **Live updates:** viewers and editors with no unsaved changes receive others' saves automatically. Editors with unsaved changes get a warning instead of being overwritten. Role changes and revoked access take effect without a reload. |
| Version history | Automatic snapshots: one per person per minute of editing, plus one whenever a different person edits. Preview any version and restore it. A restore is itself a version, so it can be undone. |
| Persistence | Postgres (Neon). Content is stored as sanitized HTML, so formatting survives a reload. |
| Safety | All access checks are done on the server, and users without access get a 404. HTML is sanitized on every write (blocks malicious scripts). The session cookie is HMAC-signed, so editing it can't impersonate another user. Stale saves return **409** instead of overwriting someone else's edits. Each save and its history entry are written in one database transaction. |
| Extra | **Export to Markdown** (`Export .md`) |

## Local setup

Requirements: Node 20+ (tested on 24), and a Postgres database. A free [Neon](https://neon.tech) database works.

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL and SESSION_SECRET
npm run db:setup                # creates/migrates tables and seeds the 3 demo users (safe to re-run)
npm run dev                     # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | 22 unit and Postgres integration tests (integration tests skip if `DATABASE_URL` is unset) |
| `npm run test:e2e` | Playwright browser test of the full share flow with three users (starts the dev server; set `E2E_BASE_URL` to test a deployment) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build && npm start` | Production build |
| `npm run db:seed-demo` | ⚠️ **Deletes all documents** and recreates a demo set (owned, shared as editor, shared as viewer, private) |

Sample files to try importing are in [`samples/`](samples/). CI (GitHub Actions) runs lint, type-check, tests and build on every push.

## Deployment

Hosted on Vercel, with the database on Neon Postgres (free tier). Set `DATABASE_URL` and `SESSION_SECRET` in the Vercel project's environment variables, run `npm run db:setup` once against the database, then run `vercel --prod`.

## Project layout

```
app/                         pages (login, document list, editor) and API route handlers
  api/documents/[id]/        get / save / delete, shares, presence, revisions, export
  api/import/                file upload → new document
components/                  DocumentEditor (autosave, live updates), Toolbar, SharePanel,
                             HistoryPanel, PresenceAvatars, ReadOnlyContent
lib/
  access.ts                  pure permission rules (owner / editor / viewer)
  documents.ts               data access; every function enforces access itself
  import-file.ts             .txt / .md / .docx → HTML
  sanitize.ts                HTML allowlist applied on every write
  session.ts, auth.ts        signed-cookie mock auth
scripts/schema.sql           idempotent schema + seed users
tests/                       vitest: access matrix, import + XSS, session signing, Postgres integration
e2e/                         Playwright: full multi-user share / presence / live-update flow
```

More detail: [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_WORKFLOW.md](AI_WORKFLOW.md) · [SUBMISSION.md](SUBMISSION.md)
