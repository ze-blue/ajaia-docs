# AI workflow note

## Tools used, and why each one

I gave different AI roles different jobs, and kept the decisions for myself.

| Tool | Role | Why this tool for this job |
|---|---|---|
| **Claude Fable 5.2** | **Planner:** scope cut, stack, schema sketch, time budget | Strong reasoning on an open-ended brief. I wanted a plan to critique before any code existed. |
| **Claude Code (Opus 5.5) in VS Code** | **Builder:** implementation, commands, tests, deploys | Works in the repo and terminal, so it runs what it writes and sees real errors. |
| **A separate Claude Code review agent** | **Reviewer:** an independent code review with no access to the builder's reasoning | A reviewer who didn't write the code isn't anchored on the author's assumptions. |
| **Chrome DevTools MCP + Playwright** | **Verifier:** the real UI as Alice, Bob and Carol in isolated sessions, locally and in production | Tests the product as users experience it, not just the functions. |

**My loop for each piece of work:** plan, then review the plan myself, then build a vertical slice, then check it with tests and a real browser, then commit and deploy. Nothing counted as done until it had been seen working, and the deployed app was retested after every change.

## Where AI materially sped things up

- **Planning in minutes.** A first scope cut, data model and time budget came back right away. I spent my time judging the plan, not drafting it.
- **Boilerplate and glue:** the Tiptap toolbar, route handlers, zod validation and the file-conversion pipeline. These are well-known patterns where AI is fast and reliable.
- **Building the stretch features after the core was done:** presence, live updates and version history took about an hour, including tests, because the core design (versioned saves, access checks in one place) made them straightforward extensions.
- **Tests at depth:** 28 unit and Postgres integration tests, plus a three-user Playwright test of the whole flow.
- **A design audit with evidence:** I had the AI act as a product designer with a written baseline ([DESIGN.md](DESIGN.md)) and a script that screenshots every core screen at three widths and measures overflow, target sizes and focus handling. It found the share dialog let keyboard focus escape, a 25×18 px button, and icons that did not grow at 200% text size. The same script caught a regression in the AI's own redesign (new button styles silently not applied because the dev server served a stale stylesheet) before it shipped.
- **UI polish measured, not just eyeballed:** I ran Lighthouse before and after the UI pass. The editor's accessibility score went from 96 to 100 (it had flagged low-contrast footer text). Mobile layouts were checked at 390 px wide.
- **Review at scale:** an independent reviewer read the whole codebase in about four minutes and returned ranked, traced findings.

## AI output I changed or rejected

**From the plan:**

| What the AI proposed | What I did and why |
|---|---|
| Store the user ID in a **plain cookie** | Rejected. Anyone could edit the cookie and become another user, which makes the sharing demo meaningless. I switched to an **HMAC-signed** cookie with a tamper test. |
| Save and render HTML **without sanitization** | Added an allowlist sanitizer on every write, plus an XSS test. Stored HTML is only displayed through Tiptap's schema; when a security hook flagged an `innerHTML` preview, I replaced it. |
| Pin **Tiptap v2** | Used v3, the current major version. |
| **Last-write-wins** saves | Added a `version` column and 409 conflicts, which later became the foundation for live updates and history. |

**From the builder:**

| Issue | What I did |
|---|---|
| Page code didn't account for **Next.js 16 Cache Components** (a blocking-route error) | Checked the docs bundled with the installed Next.js version instead of trusting the model's memory, then added `loading.tsx` boundaries. |
| Autosave used a recursive callback and setState inside an effect (lint errors) | Rewrote autosave as a loop that sends one request at a time. |
| The AI reported a **"save bug"** during testing | Before changing any code, I checked with curl and a direct database query. Saving worked: my reload had cut off the first, slow save while the dev server was compiling. No change needed. |
| An end-to-end test failed on a **"lost space"** | I traced it to the test, not the app: Tiptap 3 always keeps an empty paragraph at the end, so Ctrl+End typed into a new paragraph. I fixed the test, not the product. |

**From the independent reviewer:** 9 findings. I checked each against the code, and all held up. Fixed:

| Finding | Severity | Fix |
|---|---|---|
| After a live update, **Ctrl+Z undid the collaborator's change** and autosave wrote that over their work | High | Pulled content is kept out of undo history. I **proved the regression test catches it** by temporarily putting the old code back and watching the test fail, then restoring the fix. |
| A restore could overwrite the latest history entry | Medium | Restores always create a new revision. Regression test added. |
| The heartbeat could mistake your own in-flight save for someone else's (a false "reload" banner that never cleared) | Medium | Skip the version check during your own saves, and clear the banner on a successful save. |
| The document update and its history entry were not atomic | Medium | Both are now written in one transaction. |
| A large import could create a document that could never be saved again | Medium | Size is checked after conversion, returning 413. Test added. |
| Typing during a restore, leaving via in-app links, mid-session role changes, clearing the title | Low | Fixed each one: discard edits that were based on the replaced content, save or confirm before leaving, disable editing on downgrade, reset to the last saved title. |

The reviewer reported **no** access-control, XSS, CSRF or injection problems, which matched my own security checks.

## How I verified correctness, UX and reliability

- **Automated:** `npm test` runs 28 tests. They cover the access matrix, import and XSS stripping, size limits, and cookie tampering. **Integration tests against real Postgres** cover sharing, permission enforcement, conflicts, history coalescing, restore permissions, presence and revocation. A **Playwright test** runs three users through create, format, reload, share, read-only view, presence, live update, undo safety, upgrade, a blocked outsider and delete. It passes against the **deployed** app. CI runs lint, type-check, tests and build.
- **API checks with curl:** bad file type returns 400, no session returns 401, a forged cookie returns 401, a viewer trying to save or reshare returns 403, a stale save returns 409.
- **UX in a real browser:** screenshots of every key screen were reviewed. Save latency was measured at about 0.3 s in production.
- **Rule I followed:** AI writes code, but nothing counts as done until a test, a curl call or a browser check shows it working, and a regression test only counts once it has been seen failing without the fix.
