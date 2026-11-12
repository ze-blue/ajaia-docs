# Ajaia Docs

A lightweight collaborative document editor. You can create, rename, edit and format documents, import files as new documents, share them with other users as editor or viewer, and everything is saved to Postgres.

**Live app:** https://ajaia-docs-ten-gamma.vercel.app
**Demo accounts:** pick any of the three on the sign-in page (no password).

| User | Email |
|---|---|
| Alice Johnson | alice@example.com |
| Bob Smith | bob@example.com |
| Carol Lee | carol@example.com |

## Try the sharing flow (2 minutes)

1. Sign in as **Alice**, click **+ New document**, type a title and some formatted text. It autosaves; the header shows "All changes saved".
2. Click **Share**, enter `bob@example.com`, choose **Can view**, then click **Share**.
3. Click **← Docs**, then **Switch user**, and sign in as **Bob**. The document is listed under **Shared with me** and labeled `Alice Johnson · viewer`. It opens read-only with no toolbar.
4. Switch back to Alice, change Bob to **Editor**, and Bob can now edit. **Carol** cannot see the document at all, even if she opens its URL directly.

Tip: use a normal window for one user and a private window for another to see both at once.

## Features

| Area | What works |
|---|---|
| Documents | Create, rename (inline title), edit, autosave (800 ms debounce), reopen, delete (API, owner only) |
| Formatting | Bold, italic, underline, H1–H3, bulleted and numbered lists, block quote, undo/redo, keyboard shortcuts |
| File upload | **Import `.txt`, `.md`, `.docx` (max 2 MB)**, each becomes a new editable document titled after the file. Other types are rejected with a clear message. |
| Sharing | Owner shares by email as **editor** or **viewer**, changes a person's role, or removes access. Lists are split into **My documents** and **Shared with me**. |
| Persistence | Postgres (Neon). Content is stored as sanitized HTML, so formatting survives a reload. |
| Safety | All access checks are done on the server. HTML is sanitized on every write (blocks malicious scripts). The session cookie is HMAC-signed, so editing it can't impersonate another user. Stale saves return **409** instead of overwriting someone else's edits. |
| Stretch | **Export to Markdown** (`Export .md` button) |

## Local setup

Requirements: Node 20+ (tested on 24), and a Postgres database. A free [Neon](https://neon.tech) database works.

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL (and SESSION_SECRET)
npm run db:setup                # creates tables and seeds the 3 demo users (safe to re-run)
npm run dev                     # http://localhost:3000
```

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run db:seed-demo` | **Deletes all documents** and recreates the demo set (owned, shared-as-editor, shared-as-viewer, private) |
| `npm test` | Unit tests + Postgres integration tests (integration tests skip if `DATABASE_URL` is unset) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build && npm start` | Production build |

Sample files to try importing are in [`samples/`](samples/).

## Deployment

Hosted on Vercel, with the database on Neon Postgres (free tier). Set `DATABASE_URL` and `SESSION_SECRET` in the Vercel project's environment variables, run `npm run db:setup` once against the database, then deploy (`vercel --prod`).

## Project layout

```
app/                      pages (login, document list, editor) and API route handlers
  api/documents/...       create / update / delete / share / export
  api/import/             file upload → new document
components/               DocumentEditor (Tiptap + autosave), Toolbar, SharePanel, HomeActions
lib/
  access.ts               pure permission rules (owner / editor / viewer)
  documents.ts            data access; every function enforces access itself
  import-file.ts          .txt / .md / .docx → HTML
  sanitize.ts             HTML allowlist applied on every write
  session.ts, auth.ts     signed-cookie mock auth
scripts/schema.sql        schema + seed users
tests/                    vitest: access matrix, import + XSS, session signing, Postgres integration
```

More detail: [ARCHITECTURE.md](ARCHITECTURE.md) · [AI_WORKFLOW.md](AI_WORKFLOW.md) · [SUBMISSION.md](SUBMISSION.md)
