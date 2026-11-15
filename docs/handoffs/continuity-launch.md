# Account continuity and learning progress

Implemented for the 16 November 2026 launch upgrade. Application and test edits are frozen after integration verification. No production database, real credentials, paid AI API, or external service was accessed by this worker.

## Delivered behavior

- Profile recovery uses a random 256-bit key. The database stores only credential hashes. Authenticated key generation/replacement leaves current sessions valid, so a lost generation response can be retried. Restoring a profile replaces the key and revokes earlier sessions; signing out revokes all sessions without deleting data.
- Existing cookies without a version remain valid as version zero. Invalid version types and revoked versions are rejected. Account updates check the authenticated version again in their write condition.
- The restore client accepts an optional second `requestId` string. The UI supplies a stable UUID, retaining only that nonce in session storage for manual retries. The same old-key/nonce proof can reissue the same replacement key for five minutes without extending expiry or incrementing session version. A different nonce, expiry, subsequent restore, key replacement, or sign-out invalidates that proof.
- Replacement keys for restore retries are derived with HMAC using the session secret, submitted key, and request ID. Stored retry metadata consists of the previous-key hash, request-ID hash, expiry, and version; it contains no recoverable secret cache.
- The complete restore decision is serialized in one database transaction using an advisory lock on a namespaced digest of the old key. Exact retries are checked before first-use throttling. Invalid attempts commit their throttle count before returning an error. Lock waiting is bounded to five seconds; timeout returns a retriable 503 instead of a misleading 15-minute limit message.
- Recovery allows ten first-use attempts per hashed network identity per 15-minute window. Opportunistic deletion of stale throttle rows runs after the decision commits, avoiding cross-network cleanup lock cycles. Daily cleanup also removes throttle rows older 24 hours and clears expired retry-proof fields. Logical proof expiry does not depend on cleanup running.
- Owned-data export streams database pages of at most 250 rows. It includes the profile, saved missions, attempts, point events, authored challenges, own responses, ratings given, and own reports when the reports table exists. It excludes recovery/session material, network hashes, storage paths, and unrelated users' rows.
- Progress uses real stored attempts, including zero-point practice: distinct practiced missions, results at or above 80, averages, Korea-time activity/streaks, seven-day counts, recent feedback, and a next-mission recommendation. Historical attempts use bounded pages and preserve PostgreSQL microsecond precision in cursors. Saved missions are validated, idempotent, and profile-owned.
- Generic service errors now use action-neutral wording. Scoring failures retain their scoring-specific wording.

## Files and integration

New account and progress contracts/clients are in `src/lib/account-*` and `src/lib/progress-*`. Their API routes live under `/api/account` and `/api/progress`; repositories are `src/lib/repo/accounts.ts` and `src/lib/repo/progress.ts`. Existing API envelopes remain compatible, and shared `request`, `read`, and `jsonBody` helpers are exported from `api-client.ts` for feature clients.

Apply additive migrations in order before deploying the new server code: `004_account_continuity.sql`, community-owned `005`, and `006_account_recovery_retry.sql`. Migration 006 is separate because development databases may already have applied 004. Existing user/session rows default to version zero.

Root owns profile/onboarding and session-context UI; the learning worker owns dashboard/library/progress UI; the community worker owns report storage and community UI. This worker changed only the agreed backend/session/error-copy areas and matching tests, plus one shared recorder fallback message and the corresponding assertions.

## Verification

- `npx vitest run tests/api/account-continuity.test.ts tests/api/cleanup.test.ts tests/api/progress.test.ts`: **26 passed**. Coverage includes ownership, export privacy and pagination, Korea-time midnight/streaks, zero-point attempts, microsecond history cursors, revocation/replay, simultaneous recovery, retry expiry, lost-response regeneration, the tenth-attempt retry, and cleanup.
- `tests/api/pg.live.test.ts` with `TEST_DATABASE_URL` pointing only to the isolated local container: **10 passed** on **PostgreSQL 17.11**. Final run completed in 7.30 seconds. The suite covers mission-award and scoring-cap concurrency, recovery nonce/retry atomicity, recovery throttling, peer-rating awards, profile deletion during media writes, and incomplete-challenge compensation.
- The new deterministic PostgreSQL regression pauses the original recovery after reserving slot ten and before writing its proof. It reproduced failure before serialization. After the fix, the identical retry waits on the advisory lock, both requests return the same result, the attempt count stays ten, and session version increments once.
- A separate PostgreSQL timeout regression holds the advisory lock, verifies a bounded 503 without consuming an attempt, releases the lock, and restores successfully with the same key.
- Final TypeScript and scoped ESLint checks passed. Earlier neutral-error component checks passed all 18 tests. Root's final integrated check passed 386 tests with 11 opt-in skips; the production build and browser suite passed with 38 browser cases and six duplicate-case skips. Root is responsible for migration application and deployment evidence.
- The PostgreSQL image was already cached; Docker used `--pull never`. Only the disposable `hanlog-launch-continuity-pg` container was created, bound to `127.0.0.1:55449`, then stopped and auto-removed. Existing containers and volumes were untouched. Ordinary test runs skip the ten opt-in PostgreSQL cases.
- The focused backend review cleared the final serialization, expiry, revocation, and post-commit cleanup changes with no remaining concrete blocker found.

## Operating boundaries

Recovery remains possession-based: someone who has neither a saved key nor a signed-in browser cannot recover this profile through email or support. Keep the existing session secret stable during normal deployment; changing it deliberately revokes cookies and also invalidates an in-flight deterministic retry proof. Saved current recovery keys can still initiate a fresh restore after such a rotation.

This work does not claim learner-pronunciation calibration, native content validation, or real-device microphone verification. Those remain the launch boundaries described in the implementation plan.
