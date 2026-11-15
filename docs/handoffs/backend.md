# Backend handoff

All backend tasks are now implemented and integrated on `ws/backend`. Tasks 1–7 and 12–15 were implemented here; root's task 8 and the peer worker's tasks 9–11 were merged with ancestry preserved. See `backend-peer.md` for its repository transaction details. The account-storage failure defect is fixed. Real-Postgres verification remains explicit QA work.

## Delivered

- Server-only points tiers and labels, atomic per-mission improvement awards, points ledger and progress.
- Serialized scoring reservations with global, address and user caps, failed-call accounting, and Korea-time day boundaries.
- Link rejection plus injectable, timeout-bounded OpenAI text moderation. Malformed responses fail closed; tests make no network calls.
- Cookie session creation/update/deletion, concurrent address/session cap, public mission/reward catalog and authenticated points.
- Solo attempt validation in the exact specified order, silence rejection before reservation, mock/provider scoring, persistent attempt and points, failure outcome tracking.
- Media validation and memory/local/Supabase stores from root's task 8.
- Challenge create/list/detail, audio/video answers with replacement until rated, one-time peer ratings and feedback, reports, and authorized reference/answer delivery.
- Authenticated expiry cron, transactional cleanup with storage retry on failure, and Seoul Vercel configuration.
- Portable migration runner; optional real-Postgres concurrency suite that initializes its schema and cleans up its own test users/calls.

## Routes and coverage

| Route | Tests | State |
|---|---|---|
| GET/POST/PATCH `/api/session` | `tests/api/session.test.ts` | Verified |
| DELETE `/api/session` | `tests/api/account.test.ts` | Verified normal case and retriable storage failure |
| GET `/api/missions` | `tests/api/missions.test.ts` | Verified |
| POST `/api/missions/[id]/attempts` | `tests/api/attempts.test.ts`, `attempts-failures.test.ts` | Verified |
| GET `/api/points` | `tests/api/missions.test.ts`, `repo-attempts.test.ts` | Verified |
| GET `/api/rewards` | `tests/api/missions.test.ts` | Verified |
| GET `/api/cron/cleanup` | `tests/api/cleanup.test.ts` | Verified |
| GET/POST `/api/challenges`, GET `/api/challenges/[id]` | `tests/api/challenges.test.ts` | Verified |
| POST `/api/challenges/[id]/responses` | `tests/api/responses.test.ts` | Verified |
| POST `/api/responses/[id]/{rating,feedback,report}` | `tests/api/ratings.test.ts` | Verified |
| GET `/api/responses/[id]/media`, `/api/challenges/[id]/reference` | `tests/api/media.test.ts` | Verified |

Points, caps, moderation, and media also have focused unit suites under `tests/unit/`. Concurrent attempts cannot double-pay. Concurrent session creation cannot exceed the configured address cap. Budget reservations intentionally survive profile deletion to prevent deletion from resetting address/global spending limits; deletion replaces their user ID with the system ID. Daily cleanup removes counters from prior Korea-time days.

## Validation

- Latest integrated local `npm run check`: **148 passed, 2 skipped**, typecheck and ESLint pass. The two skips are the opt-in real-Postgres tests.
- Initial plan tests were observed failing before implementing their modules/routes. Account and cleanup tests use direct SQL fixtures to keep the parallel peer files independent; coverage includes deletion boundaries, storage failures, expiry, retries, and cron authorization.
- `npm run db:migrate` without a database URL exits nonzero and names `DATABASE_URL` / `POSTGRES_URL` without leaking connection data.
- Installed `@vercel/config` types and CLI source were inspected. `npx @vercel/config compile` produces `framework: nextjs`, `regions: [icn1]`, and cron `/api/cron/cleanup` at `0 18 * * *`.
- Production build attempted in the worktree but Turbopack rejects its `node_modules` junction outside the worktree root. Run the final build in `main`, which owns the real dependency directory. Shared Next config and package files were not changed.
- Real Postgres **was not run**. Docker CLI is installed, but its daemon cannot be reached: the `dockerDesktopLinuxEngine` named pipe is absent. Task 15's two real-concurrency assertions remain an explicit deployment/QA checkpoint.
- No real scoring, moderation, or external-storage call was made. No `.env.local` was loaded or read. Test fetches and scorer failures are deterministic fakes.

## Environment variables

The backend consumes shared configuration for `SESSION_SECRET`, `DATABASE_URL` / `POSTGRES_URL`, `PGLITE_DIR`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `MEDIA_BUCKET`, `OPENAI_API_KEY`, `SCORING_PROVIDER`, `OPENAI_SCORING_MODEL`, `USER_DAILY_ATTEMPTS`, `IP_DAILY_ATTEMPTS`, `GLOBAL_DAILY_ATTEMPTS`, `IP_DAILY_SESSIONS`, `RETENTION_DAYS`, and `CRON_SECRET`. Shared configuration also reads `NODE_ENV` and `VERCEL` for startup policy. The opt-in live suite alone reads `TEST_DATABASE_URL`. No browser-visible environment variable is introduced.

## Decisions and deviations

- Sessions count and insert under a per-address advisory lock in one transaction, instead of an unprotected count/create sequence. The route performs its small insert directly because the frozen shared `createUser` repository does not accept a transaction parameter.
- Spending windows include both start and end boundaries; checks use global, address, then user order. Failed calls still consume a reservation.
- Moderation requires one boolean result per submitted nonempty text. An incomplete/malformed service response is unavailable, never implicitly approved.
- Cleanup locks parent challenges before answer rows, and holds those row locks through file removal and pointer clearing. If storage fails, the transaction retains metadata so retry is possible. Missing files are ignored by the stores.
- Account deletion deviates from task 13's DB-first instruction to satisfy the spec's stronger deletion promise. It removes files inside the cascade transaction before deleting rows. Storage failure returns 503 without clearing the cookie and rolls back identity/media pointers; retry succeeds. Parent/answer rows remain locked during removal. Budget counters lose their deleted profile ID and expire in daily cleanup once outside the current Korea-time day.
- Vercel config uses a default export. The installed package README recommends a named `config`, but its actual CLI serializes that as an incorrect nested `config` object. Default export was verified through compilation.
- Tasks 13–14 use direct SQL fixture creation, avoiding concurrent edits to peer-owned helpers. This preserves all specified normal-case assertions and adds failure coverage.
- Media delivery sends stored content types with `private, no-store` and `nosniff`. Tests cover both entitled people, sample raters, outsiders, missing/flagged/expired/hidden media, malformed identifiers, and public reference access by signed-in users. Retention is enforced before cron removes files.
- Peer repositories add transaction-bound media bytes and authenticated responder-id arguments to their internal APIs; all HTTP contracts remain unchanged. See `backend-peer.md`.
- Live PostgreSQL tests own/close a pool and clean up only rows they create. They auto-apply portable migrations and seed, so a fresh throwaway DB is sufficient.

## Requests / unresolved QA work

1. Merge this tested backend branch to `main` and run the production build there. Peer integration is complete; retention-at-delivery, role-switch self-rating defense, concurrent awards, and pending-answer replacement have regression coverage.
2. Run the live Postgres tests when Docker or a throwaway `TEST_DATABASE_URL` is available.
3. Privacy copy should state that detached cost-control counters remain until daily cleanup; deletion immediately removes the profile association, and counters from prior Korea-time days are then purged.
4. Follow the user-authorized small-call budget when enabling real scoring. End-to-end tests should explicitly set `OPENAI_API_KEY=` and `SCORING_PROVIDER=mock` so ignored local settings cannot enable moderation calls.
