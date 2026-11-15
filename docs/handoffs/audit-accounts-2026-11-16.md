# Account, session and progress audit — 16 November 2026

## Confirmed defects and repairs

- A request could read a valid session, finish after sign-out or restore, and still edit/delete the profile or change saved expressions. Four deterministic API regressions returned 200/204 before the fix. APIs now preserve the session version; profile edits use a conditional UPDATE, and saved/deletion transactions check the version again. The shared `lockSessionUser` helper holds a user row SHARE lock through a write and returns the current role for community authorization. Public mutation routes always supply the expected version; trusted repository callers can omit it.
- Deletion initially held only a SHARE lock. A scoring reservation could commit after the deletion transaction detached existing scoring identifiers, retaining a deleted profile ID. The PostgreSQL regression found one residual scoring row. Deletion now acquires the user row FOR UPDATE before collecting media or detaching identifiers, so a late reservation waits and then fails authorization. Scoring rows have no user foreign key: the observed defect was retained identity, not lost spending limits.
- The daily onboarding limit counted surviving profiles, so create → delete → create returned 201 with a one-profile daily cap. Migration `007_session_creation_limits.sql` introduces an atomic per-network-hash/Korea-date counter with no profile IDs. Creation and reservation commit together; failed creation rolls back its slot. Deletion preserves the daily count, and cleanup removes counters from prior Korea dates. The migration backfills today's surviving profiles; creations deleted before this migration cannot be reconstructed.

The community worker also corrected parent/response lock ordering, cleanup ordering, and review of a report deleted in flight. This lane added real PostgreSQL regressions for those interactions, without editing the community implementation.

## Verification

- `tests/api/session.test.ts`, `session-revocation.test.ts`, `account.test.ts`, `account-continuity.test.ts`, `progress.test.ts`, `cleanup.test.ts`, `tests/unit/db/db.test.ts`, and `tests/unit/repo/users.test.ts`: **56 passed**. Includes deleted-profile quota retention, rollback, exact Korea-midnight reset, migration backfill, cleanup expiry, revoked requests, ownership, exports, recovery retry/expiry, streaks, and microsecond history cursors.
- All **17** `tests/api/pg.live.test.ts` cases passed together on **PostgreSQL 17.11**, final duration **6.88 seconds**. Seven additional cases cover concurrent onboarding with deletion, authorization/revocation ordering, queued stale deletion after restore, late-reservation identity retention, cleanup/content lock ordering, reporting during author deletion, and reporter deletion during review. The existing ten concurrency cases still pass.
- Scoped ESLint and full TypeScript checks passed. Root owns final integrated `npm run check`, build, browser verification, commit and deployment.
- PostgreSQL used only the disposable `hanlog-audit-pg` container, cached `postgres:17-alpine` with `--pull never`, and loopback `127.0.0.1:55449`. It used no production credentials, mounted no persistent volumes, and was stopped and auto-removed. Existing containers were untouched. No real AI or production request was made.

## Reviewed surfaces and limits

Reviewed session signing/claim validation, account generation/rotation/logout/recovery transactions and clients/contracts, all account/progress routes, profile create/edit/delete, deletion/media ownership, export projections/page boundaries, progress aggregation/Korea dates, history cursor encoding/filter ownership, saved-expression mutation, schema migrations and related tests. Read the bundled Next.js route-handler documentation before route edits.

No additional concrete defect was established in possession-based recovery, the five-minute exact retry proof, credential-free owned export, or progress pagination/time calculations. A missing saved key and missing signed-in browser intentionally leave no recovery method. This audit does not claim recovery of already-deleted historical quota events, a consistent snapshot during concurrent export changes, native-speaker assessment calibration, or real-device microphone coverage.

Apply migration **007** before deploying the code that uses its table. Keep the existing session secret stable. No commit was made by this worker.
