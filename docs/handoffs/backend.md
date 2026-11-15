# Backend handoff

Backend solo/core work is on `ws/backend`. Tasks 1–7 and 13–15 are implemented here. Root's task 8 media implementation was merged from `ws/backend-peer` with ancestry preserved. Tasks 9–12 remain on the separate peer workstream until integration; see its handoff when available. Do not treat the whole backend as integrated until those commits are merged and checked.

## Delivered

- Server-only points tiers and labels, atomic per-mission improvement awards, points ledger and progress.
- Serialized scoring reservations with global, address and user caps, failed-call accounting, and Korea-time day boundaries.
- Link rejection plus injectable, timeout-bounded OpenAI text moderation. Malformed responses fail closed; tests make no network calls.
- Cookie session creation/update/deletion, concurrent address/session cap, public mission/reward catalog and authenticated points.
- Solo attempt validation in the exact specified order, silence rejection before reservation, mock/provider scoring, persistent attempt and points, failure outcome tracking.
- Media validation and memory/local/Supabase stores from root's task 8.
- Authenticated expiry cron, transactional cleanup with storage retry on failure, and Seoul Vercel configuration.
- Portable migration runner; optional real-Postgres concurrency suite that initializes its schema and cleans up its own test users/calls.

## Routes and coverage

| Route | Tests | State |
|---|---|---|
| GET/POST/PATCH `/api/session` | `tests/api/session.test.ts` | Verified |
| DELETE `/api/session` | `tests/api/account.test.ts` | Verified normal case; storage failure limitation below |
| GET `/api/missions` | `tests/api/missions.test.ts` | Verified |
| POST `/api/missions/[id]/attempts` | `tests/api/attempts.test.ts`, `attempts-failures.test.ts` | Verified |
| GET `/api/points` | `tests/api/missions.test.ts`, `repo-attempts.test.ts` | Verified |
| GET `/api/rewards` | `tests/api/missions.test.ts` | Verified |
| GET `/api/cron/cleanup` | `tests/api/cleanup.test.ts` | Verified |
| Challenge create/list/detail, answers, rating/feedback/report, media delivery | Peer tasks 9–12 | Pending peer merge |

Points, caps, moderation, and media also have focused unit suites under `tests/unit/`. Concurrent attempts cannot double-pay. Concurrent session creation cannot exceed the configured address cap. Budget reservations intentionally survive profile deletion to prevent deletion from resetting spending limits.

## Validation

- Latest local `npm run check`: **119 passed, 2 skipped**, typecheck and ESLint pass. The two skips are the opt-in real-Postgres tests.
- Initial plan tests were observed failing before implementing their modules/routes. Account and cleanup tests use direct SQL fixtures to keep the parallel peer files independent; coverage includes deletion boundaries, storage failures, expiry, retries, and cron authorization.
- `npm run db:migrate` without a database URL exits nonzero and names `DATABASE_URL` / `POSTGRES_URL` without leaking connection data.
- Installed `@vercel/config` types and CLI source were inspected. `npx @vercel/config compile` produces `framework: nextjs`, `regions: [icn1]`, and cron `/api/cron/cleanup` at `0 18 * * *`.
- Production build attempted in the worktree but Turbopack rejects its `node_modules` junction outside the worktree root. Run the final build in `main`, which owns the real dependency directory. Shared Next config and package files were not changed.
- Real Postgres **was not run**. Docker CLI is installed, but its daemon cannot be reached: the `dockerDesktopLinuxEngine` named pipe is absent. Task 15's two real-concurrency assertions remain an explicit deployment/QA checkpoint.
- No real scoring/moderation/network request was made. No `.env.local` was loaded or read. Test fetches and scorer failures are deterministic fakes.

## Environment variables

The backend consumes shared configuration for `SESSION_SECRET`, `DATABASE_URL` / `POSTGRES_URL`, `PGLITE_DIR`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_BUCKET`, `OPENAI_API_KEY`, `SCORING_PROVIDER`, `OPENAI_SCORING_MODEL`, `USER_DAILY_ATTEMPTS`, `IP_DAILY_ATTEMPTS`, `GLOBAL_DAILY_ATTEMPTS`, `IP_DAILY_SESSIONS`, `RETENTION_DAYS`, and `CRON_SECRET`. Shared configuration also reads `NODE_ENV` and `VERCEL` for startup policy. The opt-in live suite alone reads `TEST_DATABASE_URL`. No browser-visible environment variable is introduced.

## Decisions and deviations

- Sessions count and insert under a per-address advisory lock in one transaction, instead of an unprotected count/create sequence. The route performs its small insert directly because the frozen shared `createUser` repository does not accept a transaction parameter.
- Spending windows include both start and end boundaries; checks use global, address, then user order. Failed calls still consume a reservation.
- Moderation requires one boolean result per submitted nonempty text. An incomplete/malformed service response is unavailable, never implicitly approved.
- Cleanup locks parent challenges before answer rows, and holds those row locks through file removal and pointer clearing. If storage fails, the transaction retains metadata so retry is possible. Missing files are ignored by the stores.
- Vercel config uses a default export. The installed package README recommends a named `config`, but its actual CLI serializes that as an incorrect nested `config` object. Default export was verified through compilation.
- Tasks 13–14 use direct SQL fixture creation, avoiding concurrent edits to peer-owned helpers. This preserves all specified normal-case assertions and adds failure coverage.
- Live PostgreSQL tests own/close a pool and clean up only rows they create. They auto-apply portable migrations and seed, so a fresh throwaway DB is sufficient.

## Requests / unresolved QA work

1. **Account deletion storage failure is not durable.** Task 13 explicitly instructs DB cascade first, swallow storage errors, and log orphan paths; the route currently implements that plan. This conflicts with the stronger spec's mandatory expiry/data deletion promise because failed storage removal leaves orphan private recordings outside the cron's metadata. Root has accepted this as a QA defect. Recommended fix: add an optional media-remover callback to shared `deleteUserCascade`, invoke it inside the transaction before cascading, and let the route fail retriably if storage removal fails. Update the failure test to expect preserved identity/metadata and retry. Do not describe the current failure path as successful recording deletion.
2. Integrate peer tasks 9–12, then run all checks and build from `main`. Peer owner has been told to enforce retention at delivery before cron, prevent self-rating after role switches, and lock pending-answer replacement against cleanup/rating.
3. Run the live Postgres tests when Docker or a throwaway `TEST_DATABASE_URL` is available.
4. Reconcile the privacy notice with retention of cost-control reservations; deleting those rows would defeat address/global spend limits.
5. Follow the user-authorized small-call budget when enabling real scoring. End-to-end tests should explicitly set `OPENAI_API_KEY=` and `SCORING_PROVIDER=mock` so ignored local settings cannot enable moderation calls.
