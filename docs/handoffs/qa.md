# Integrated QA handoff

Final QA ran alone on main after all feature branches were merged. No paid API request was made during integration or browser tests.

## Results

- Production build: passes, all planned local routes, privacy, icon and Open Graph image generated.
- Code checks: TypeScript and ESLint pass; **277 unit/API/component tests passed, 3 opt-in live tests skipped**, across 55 passing files and 2 skipped files.
- Playwright: **31 passed, 5 intentionally skipped**. The five skips omit the duplicate phone project accessibility sweep; that sweep explicitly tests 320, 390, 768 and 1440 widths in the desktop project.
- Both phone and desktop pass guest consent/scoring/point carryover, onboarding, repeat-award protection, denied-microphone upload, delete/re-onboard, two-browser challenge/answer/play/rate/feedback with balances 32/20, video answer, invalid share link, cleanup authorization, headers, cookie flags and cross-origin refusal.
- Accessibility: no serious or critical axe violations on the public and signed-in screens tested; keyboard recording/scoring passes.
- Screenshots reviewed: output/playwright/intro-phone.png and intro-desktop.png. Hero action fits the initial viewport; layout uses the specified margin, serif hierarchy and v0.4 palette.
- Browser bundle and tracked-file secret checks pass. Server trace inspection found **0** private local files, docs or test files across 31 traces after the tracing fix.
- Final local launcher smoke passes at http://localhost:3000: 24 missions, successful profile creation/deletion, and PNG share image. The posting form has no overflow at 320/390/1440. Reduced motion disables transitions/animations, keyboard focus shows a 3px outline, and 2x CSS text-scale reflow does not overflow. Native browser zoom and physical devices remain separate checks. The temporary QA profile was deleted.
- The share image uses the renderer's bundled font fallback; the application itself uses the specified local serif/body font stacks.

## Defects found and resolved

1. Tailwind's broad CSS loader rewrote CSS Modules as global CSS, removing class mappings. A real browser saw the hero title at 16px. Restricting that loader to globals.css restored module styling; smoke now asserts the rendered title is at least 32px.
2. The privacy policy link relied on color within a paragraph. Added an underline; axe now passes.
3. Initial plan selectors matched both application text and Next's route announcer, or multiple partial link names. Tests now use heading roles, scoped alerts and exact navigation names. The peer test selects its own challenge instead of assuming the shared board has only one pending answer.
4. Browser fixtures now use isolated media storage. Migration tracing includes only the required SQL instead of the whole workspace.

## Limits

Real iPhone Safari/Android hardware, real PostgreSQL concurrency, hosted Supabase/Vercel storage, deployed smoke tests, dependency advisory assessment and scoring calibration remain deferred. Two PostgreSQL tests and one paid scoring test stay opt-in/skipped. No production readiness or real pronunciation accuracy is claimed.

The remaining build notice is metadataBase falling back to localhost; set the canonical hosted URL before deployment.
