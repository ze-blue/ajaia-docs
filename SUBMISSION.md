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
| Automated tests | [tests/](tests/) (`npm test`), [e2e/](e2e/) (`npm run test:e2e`), CI in [.github/workflows/](.github/workflows/) |

## Test accounts

No passwords. Pick a user on the sign-in page.

| User | Email |
|---|---|
| Alice Johnson | alice@example.com |
| Bob Smith | bob@example.com |
| Carol Lee | carol@example.com |

## Status

**Working end to end (verified in production):**
- **Documents:** create, rename, edit and autosave; Ctrl+S; delete with confirmation; word count
- **Rich text:** bold, italic, underline, strikethrough, code, links, H1–H3, bulleted and numbered lists, quote, divider, undo/redo; keyboard shortcut help. Formatting is preserved on reopen.
- **File upload:** import `.txt`, `.md` or `.docx` (max 2 MB) as a new document (button or drag-and-drop), or insert a file's content into the current document. Unsupported files are rejected with a clear message.
- **Sharing:** by email as editor or viewer; change roles; remove access. Separate "My documents" and "Shared with me" lists; read-only viewer mode.
- **Collaboration:** presence avatars; collaborators' saves pulled in automatically; conflict warnings instead of silent overwrites; role changes and revoked access applied without a reload.
- **Version history:** preview and restore (stretch goal)
- **Export to Markdown** (stretch goal)
- **Quality:** validation and error messages on every endpoint; 28 unit and integration tests; a Playwright browser test with three users; CI; Lighthouse accessibility, best practices and SEO all 100 on mobile

**Partial or not included:**
- No character-level real-time co-editing. Changes sync as whole saves every few seconds rather than letter by letter, and simultaneous edits to the same document are detected (409) rather than merged.
- Mock authentication only.
- No comments, attachments, images or tables.

**Next 2–4 hours:** real-time co-editing with Yjs and live cursors, real authentication with share invites, comments, revision diffs. See [ARCHITECTURE.md](ARCHITECTURE.md#what-id-build-next-24-hours).
