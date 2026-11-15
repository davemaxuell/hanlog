# Backend peer handoff

Implemented backend tasks 9–11 on `ws/backend-peer`, based on task 8 (`b9c6014`). Task 12 media delivery was handed to the backend worker after task 10 checkpoint `15ddb77`; this branch does not own those routes, cleanup, session deletion or deployment configuration.

## Routes and tests

- `GET/POST /api/challenges`, `GET /api/challenges/[id]`: `tests/api/challenges.test.ts` (create, references, roles/fields/moderation/caps, scopes, code lookup, concurrent cap and failed upload rollback).
- `POST /api/challenges/[id]/responses`: `tests/api/responses.test.ts` (answers, replacement, sample viewing, access/media checks, daily cap, failed replacement rollback, concurrent replacement, retention reset and rated-media immutability).
- `POST /api/responses/[id]/{rating,feedback,report}`: `tests/api/ratings.test.ts` (awards, authorization, samples, one-time feedback, deleted rater, reporting, concurrent awards and role-switch self-rating).
- Shared request helpers are exported from `tests/api/_helpers.ts` for backend integration.

## Implementation notes

- Challenge and response daily caps are rechecked under per-user advisory locks in the insertion transaction; prechecks preserve the plan's request validation order.
- `upsertResponse` accepts an additional required `bytes` field. It holds the response row lock while storing the new recording and removing a superseded path. Failed storage restores the old bytes/path and rolls back SQL. The lock coordinates with rating, reporting and cleanup. Fixed media paths follow the spec. A simultaneous database/storage outage can still prevent compensation; only the path is logged in that case.
- Replacement resets `created_at`, so the retention deadline follows the latest upload. Public media flags check the retention deadline before the daily cleanup job; the backend media routes must also enforce it.
- `giveFeedback` accepts a required `responderId` from the authenticated route so its transaction can recheck ownership. Rating rechecks the rater's current role and authorization inside its transaction. Point locks are acquired in sorted user-id order before the row lock to avoid opposite-order deadlocks.
- Public response objects omit storage paths, rater ids and internal moderation fields. Flagged answers remain visible only as the responder's `myResponse`, with `mediaAvailable: false`; rating and feedback return 404.
- Authors may rate their challenges after switching role, as section 7 names the author independently of the sample-only Korean-role rule. Responders can never self-rate, including after switching role.
- Corrected the plan's daily-answer-cap test fixture: create its target challenge before manually inserting 30 challenges for the same author; otherwise the challenge creation cap prevents the test from reaching the answer cap.
- No new environment variables. The repositories use the existing `RETENTION_DAYS` configuration. Routes use existing session, moderation and storage configuration. No external service or real key was used.

Validation: `npm run check` passed before task 9 (111 tests), task 10 (119 tests), and task 11 (127 tests across 25 files); TypeScript and ESLint passed. PostgreSQL concurrency and deployed storage behavior belong to backend/QA validation; these checks use PGlite and memory storage.
