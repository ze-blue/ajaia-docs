# AI workflow note

## Tools used

| Tool | Used for |
|---|---|
| **Claude (Fable 5.2, chat)** | First pass at scope: stack, cuts, time plan, schema sketch |
| **Claude Code (Opus 5.5) in VS Code** | Implementation, running commands, tests, and browser verification in my workspace |
| **Chrome DevTools MCP** (driven by Claude Code) | Clicking through the real UI as two users at once, in isolated browser sessions |

## Where AI materially sped things up

- **Planning in minutes.** A first scope cut, data model and time budget came back right away. I spent my time judging the plan, not drafting it.
- **Boilerplate and glue:** the Tiptap toolbar, route handlers, zod validation and the file-conversion pipeline. These are well-known patterns where AI is fast and reliable.
- **Tests.** The permissions matrix and the Postgres integration test (share → viewer blocked → upgrade to editor → revoke → stale save gets 409) were written in one pass and run against the real database.
- **Verification at scale.** Claude Code drove a real browser as Alice and as Bob in separate sessions, uploaded a `.docx`, and checked that the content survived a reload. Doing that by hand after every change would have cost far more time.

## AI output I changed or rejected

| What the AI proposed | What I did and why |
|---|---|
| The first plan (chat) stored the user ID in a **plain cookie** | Rejected. Anyone could edit the cookie and become another user, which makes the sharing demo meaningless. I switched to an **HMAC-signed** cookie (`lib/session.ts`) with a tamper test. |
| The first plan saved and rendered HTML **without sanitization** | Added an allowlist sanitizer on every write, plus an XSS test (`<script>`, `onerror`, `javascript:` links). |
| The first plan pinned **Tiptap v2** | Used v3, the current major version, which includes underline in StarterKit. |
| The first plan used **last-write-wins** saves | Added a `version` column and 409 conflicts so concurrent edits are never silently lost. |
| Generated page code didn't account for **Next.js 16 Cache Components** (enabled by the scaffold), which caused a blocking-route error | Checked the docs bundled with the installed Next.js version instead of relying on the model's memory, then added `loading.tsx` Suspense boundaries. |
| The generated autosave used a **recursive callback** and setState inside an effect, and the linter flagged both | Rewrote autosave as a loop that sends one request at a time, and moved data loading to an effect with cancellation. |
| During testing, the AI reported a **"save bug"** (edits didn't persist) | Before changing any code, I confirmed with curl and a direct database query that saving worked. The cause was a reload that cut off the first save while the dev server was still compiling. The unsaved-changes warning had correctly fired. No code change needed. |

## How I verified correctness, UX and reliability

- **Automated:** `npm test` runs 19 tests: the access matrix, import conversion and XSS stripping, size and type limits, cookie tamper rejection, and **integration tests against real Postgres** for sharing, permissions, persistence and conflicts. `npm run lint`, `typecheck` and `build` all pass.
- **Manual and scripted API checks with curl:** unsupported file type returns 400, no session returns 401, a forged cookie returns 401, and a viewer trying to save returns 403.
- **In the browser:** formatting (H1, bold, lists) survives a reload. The viewer sees a read-only document with a "Shared by Alice · viewer" badge. `.docx` import keeps headings, bold and lists.
- **Rule I followed:** AI writes code, but nothing counts as done until a test, a curl call or a browser check shows it working. Every claim in the README was demonstrated at least once.
