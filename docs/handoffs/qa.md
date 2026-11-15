# Integrated QA handoff

Final QA ran on main after all feature branches and the detail-review fixes were merged, on 16 November 2026. No paid API request was made during integration, browser tests, or the detail pass.

## Results

- Production build: passes, all planned local routes, privacy, icon and Open Graph image generated.
- Code checks: TypeScript and ESLint pass; **328 unit/API/component tests passed, 7 opt-in live tests skipped**, across 59 passing files and 2 skipped files. Six skipped PostgreSQL cases passed separately against local PostgreSQL 17; the seventh is the deliberately unrun paid scoring test.
- Playwright: **35 unique tests passed, 5 intentionally skipped**. The five skips omit the duplicate phone project accessibility sweep; that sweep explicitly tests 320, 390, 768 and 1440 widths in the desktop project. The initial full run had 33 passes and two new canonical-link assertions expecting a trailing slash that Next normalizes away. After correcting only that assertion, all six smoke tests passed on both projects against the same production build. No application change or rebuild was needed.
- Both phone and desktop pass guest consent/scoring/point carryover, onboarding, repeat-award protection, denied-microphone upload, delete/re-onboard, two-browser challenge/answer/play/rate/feedback with balances 32/20, video answer, invalid share link, cleanup authorization, headers, cookie flags and cross-origin refusal.
- Both projects also pass expired-cookie save → stable onboarding → fresh profile, absolute share-image metadata/PNG dimensions, private-route noindex, 48 px rating targets at 320/390 widths, report-dialog Cancel/Escape focus, and report-last-answer empty-state/focus recovery.
- Accessibility: no serious or critical axe violations on the public and signed-in screens tested; keyboard recording/scoring passes.
- Screenshots reviewed: the mobile introduction viewport, full introduction, 320 px rating form, and new 1200×630 sharing image. Hero action fits the initial viewport; rating controls remain usable; layout preserves the specified serif hierarchy and v0.4 palette. Browser artifacts are under `output/playwright`.
- Browser bundle and tracked-file secret checks pass. Server trace inspection found **0** private local files, docs or test files across 31 traces after the tracing fix.
- Final local launcher smoke passes at http://localhost:3000: 24 missions, successful profile creation/deletion, and PNG share image. The posting form has no overflow at 320/390/1440. Reduced motion disables transitions/animations, keyboard focus shows a 3px outline, and 2x CSS text-scale reflow does not overflow. Native browser zoom and physical devices remain separate checks. The temporary QA profile was deleted.
- The share image now bundles Libre Baskerville Regular with its SIL Open Font License, avoiding the previous generic fallback. Metadata uses `SITE_URL` or Vercel system hosts; the localhost metadataBase warning is gone.
- Dependency audit: **zero vulnerabilities**. Static Vercel JSON configuration removed the unused SDK's dependency chain, and a scoped minimatch override addresses the tooling advisory.

## Defects found and resolved

1. Tailwind's broad CSS loader rewrote CSS Modules as global CSS, removing class mappings. A real browser saw the hero title at 16px. Restricting that loader to globals.css restored module styling; smoke now asserts the rendered title is at least 32px.
2. The privacy policy link relied on color within a paragraph. Added an underline; axe now passes.
3. Initial plan selectors matched both application text and Next's route announcer, or multiple partial link names. Tests now use heading roles, scoped alerts and exact navigation names. The peer test selects its own challenge instead of assuming the shared board has only one pending answer.
4. Browser fixtures now use isolated media storage. Migration tracing includes only the required SQL instead of the whole workspace.
5. The detail pass reproduced and fixed expired-session loops, stale points responses, discarded reference blobs, cleanup exceptions, media retry, report focus and small rating targets; see `detail-ui.md`.
6. Request buffering is bounded before parsing, actual container duration/type is validated, and production configuration fails clearly when incomplete. Durable cleanup handles failed uploads/replacements and profile erasure. Review found and fixed ambiguous COMMIT compensation and a PostgreSQL snapshot race; see `detail-server.md`.
7. Incomplete/refused/ambiguous provider responses fail closed, equivalent Korean Unicode is normalized, evaluation cannot treat missing human evidence as a pass, and reference generation has explicit request budgets; see `detail-scoring.md`.

## Limits

Real iPhone Safari/Android hardware, native content review, hosted Supabase/Vercel storage, deployed smoke tests and scoring calibration remain pending. Six PostgreSQL tests stay opt-in in normal checks but were run separately and passed. The paid scoring test was not run. No production readiness or real pronunciation accuracy is claimed.
