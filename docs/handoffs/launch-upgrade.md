# HanLog launch upgrade — 16 November 2026

## What changed

The final nine-slide `Daewoong_Thinking_Project_Topic2_Final.pptx` is the visual and product reference. Open Window v0.5 uses its Paperlogy/Pretendard typography, navy outlines, sky and buttercream surfaces, pink actions, and arched window motif. Landing, onboarding, five-tab navigation, learning screens, community, profile, help, icons, install manifest, and the sharing image now follow that identity. Fonts are bundled with their licenses.

The app supports a returning learner's full loop: find a real expression, save it, practise, revisit feedback, see Korea-time progress, and exchange recordings with Korean-speaking peers. New features include a searchable/filterable 24-mission library, saved expressions, attempt history, streaks and a seven-day activity chart, real next-practice recommendations, points milestones, and an actionable community inbox. Commercial rewards and redemption claims were removed from the active UI.

Profiles can create a private recovery key, restore on another device, replace keys, sign out everywhere, download owned data, and delete it. Keys are 256-bit credentials stored only as hashes. Restore rotates the key and revokes old sessions; an exact request can safely retry for five minutes. An atomic PostgreSQL lock prevents a lost-response retry being stranded behind the guess limit. The UI requires acknowledgment of the replacement key before continuing.

Community queries are paged and bounded. Search, invitation-code entry, durable share links, direct links to older feedback, refresh without discarding drafts, and report review are supported. A challenge report hides it from the reporter's board; an answer report immediately hides its recording. Operator decisions are auditable. See [community operations](community-launch.md) and [account/progress implementation](continuity-launch.md).

## Verification

- TypeScript, ESLint, and 386 unit/API/component tests passed. Eleven opt-in tests were skipped in this ordinary run: ten PostgreSQL tests and one paid AI test.
- All ten PostgreSQL tests passed separately against disposable local PostgreSQL 17.11, including simultaneous restores, the tenth-attempt retry race, and bounded lock-timeout recovery. The container was removed afterward.
- Production build and all 38 browser journeys passed; six duplicate phone accessibility runs were intentionally skipped because the desktop sweep explicitly exercises 320, 390, 768, and 1440px widths. No serious/critical axe issues remained. Coverage includes both-device recovery, saved history, export/delete, guest practice, peer exchanges, recording/upload fallback, and keyboard use.
- Browser bundle/secret checks passed; all 46 server traces excluded private local files, tests, and documentation. Screenshots were reviewed for landing, dashboard, library, community, profile, and sharing image. Generated browser reports are excluded from ESLint after the first failure report exposed the missing ignore.
- No additional paid AI scoring calls were made for this upgrade. Local builds/browser checks explicitly use mock scoring and an empty API key.

## Release operations

Additive migrations `004_account_continuity.sql`, `005_community.sql`, and `006_account_recovery_retry.sql` were applied successfully to the production private `hanlog` schema on 16 November, before deploying the upgraded application. The prior version remains compatible with the added columns/tables. The migration runner records applied filenames and runs SQL transactionally; do not manually replay an applied migration.

The existing Vercel project, private Supabase bucket, daily retention cron, strict PostgreSQL TLS, and server-only OpenAI configuration remain in place. Production limits remain 30 scored calls per profile, 100 per network address, and 100 globally per Korea-time day. A zero-cost post-release smoke should verify account recovery, saved progress, exports, community paging/report ownership, and temporary-profile deletion without invoking `/api/score`.

Read-only monitoring: `node scripts/smoke.mjs https://hanlog-nine.vercel.app`. Community operator command: `npx tsx scripts/review-community-reports.ts list`. Review mutations require the explicit `--apply` flag and a server-only PostgreSQL environment; never put a connection URL in command history or documentation.

## Remaining launch work

This is a public beta, not a claim of validated pronunciation assessment. Native-speaker review, consented learner calibration, and real iPhone Safari/Android checks remain. Peer roles are self-selected, not verified credentials. Reference audio was not bulk-generated, and partner rewards are not offered. The privacy operator is HanLog team. The manifest supports installation where the browser permits it; private responses and recordings are not cached for offline use.
