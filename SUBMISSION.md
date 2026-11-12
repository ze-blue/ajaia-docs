# Submission: Ajaia Docs

**Candidate:** Ebisa Dugo · ebisadugo@gmail.com

| Item | Where |
|---|---|
| Live app | https://ajaia-docs-ten-gamma.vercel.app |
| Source code | This folder (also on GitHub: _REPO_URL_) |
| Setup and run instructions | [README.md](README.md) |
| Architecture note | [ARCHITECTURE.md](ARCHITECTURE.md) |
| AI workflow note | [AI_WORKFLOW.md](AI_WORKFLOW.md) |
| Walkthrough video URL | [VIDEO_URL.txt](VIDEO_URL.txt) |
| Screenshots | [screenshots/](screenshots/) |
| Sample files for import testing | [samples/](samples/) (`.docx`, `.md`, `.txt`) |
| Automated tests | [tests/](tests/), run with `npm test` |

## Test accounts

No passwords. Pick a user on the sign-in page.

| User | Email |
|---|---|
| Alice Johnson | alice@example.com |
| Bob Smith | bob@example.com |
| Carol Lee | carol@example.com |

## Status

**Working end to end:** create, rename, edit and autosave documents; rich text (bold, italic, underline, H1–H3, bulleted and numbered lists, quote); reopen with formatting preserved; import `.txt`/`.md`/`.docx` as a new document; share by email as editor or viewer; change roles and remove access; separate "My documents" and "Shared with me" lists; read-only viewer mode; conflict detection on stale saves; Markdown export; validation and error messages; 19 automated tests; live deployment.

**Partial or not included:** no real-time co-editing (concurrent edits are detected with a 409 and the user is asked to reload, but changes are not merged); mock authentication only; no delete button in the UI (the API exists and is tested); no attachments, images or tables.

**Next 2–4 hours:** version history and restore, real-time co-editing with Yjs and presence, real authentication with share invites, Playwright end-to-end tests. See [ARCHITECTURE.md](ARCHITECTURE.md#what-id-build-next-24-hours).
