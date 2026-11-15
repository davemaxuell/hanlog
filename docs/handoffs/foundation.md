# Foundation handoff

Completed all ten foundation tasks on `main`; tagged `foundation-done` after validation.

## Built and verified

- Next.js 16.4.6 / React 19.3.0 / Node 24 scaffold; all requested runtime and test dependencies installed, lockfile committed.
- Shared validated contracts, HTTP/error helpers, configuration, PCM WAV utilities, PGlite/pg adapters and portable migration, signed cookie sessions, repositories and API helpers.
- Six initial missions, six rewards, two sample challenges, idempotent seed and deterministic daily missions.
- Scoring composition and jamo gate, deterministic mock provider, explicit OpenAI stub, typed fetch client and UI response fixtures.
- Local font root layout and `/` + `/app` placeholders. All design resources copied into this repository.
- `npm run check`: 72 passing tests across 16 files; TypeScript and ESLint pass. Every task's test failed before implementation and checks passed before its commit.
- `npm run build`: passes; `/`, `/app`, and the built-in not-found route generated.
- Production startup without SESSION_SECRET refuses server preparation with the variable named. `getConfig` also verifies CRON_SECRET and persistent stores on Vercel. Startup validation is in `src/instrumentation.ts`; compilation skips runtime validation.
- Playwright CLI opened the dev page, found heading HanLog, verified page title and computed canvas `rgb(210, 246, 252)`. Browser console contained only React DevTools/HMR informational messages. Browser and both test servers were stopped.
- No real API call was made. Vitest does not load `.env.local`. Owner-supplied secrets remain ignored and were never read or printed.

## Decisions and deviations

1. The external design direction changed during implementation from v0.3 warm linen to v0.4 **Sky, Buttercream & Berry**. Per spec section 14, the newer external source wins. Root confirmed this. `docs/design/open-window/` is an exact copy; CSS and the token test target v0.4. `apricot` aliases buttercream and `clay` aliases blush for compatibility with older plan contracts. Use `action` pink fill with **ink** button text; use `action-stroke` berry for links, focus, status markers, and white checks. The token file's `controls.focus.color` still says `action`, but design prose explicitly requires accessible berry; CSS follows that prose. The stale spec14 color table needs reconciliation by integration.
2. Scaffold's `@types/node` ^20 could not satisfy Vitest 5.1.0; installed exact 24.19.2, matching runtime Node 24.15.0. Other supplied versions installed unchanged. React/Tailwind remain scaffold versions as instructed. Added package ESM type and Node 24 engine range.
3. Disabled scaffold cacheComponents/partialPrefetching defaults, since this app's request/session handlers use the conventional uncached App Router model. No remote fonts are loaded.
4. Added startup instrumentation and expired/wrong-algorithm JWT tests beyond the plan's examples. `useTestDb` is a Vitest lifecycle helper, so React hook linting is disabled only for Node test files/helpers.
5. Budget reservations in `scoring_calls` deliberately survive profile deletion (no FK in authoritative schema), preventing repeated profile deletion from resetting address/global cost caps. Added a regression test. QA should reconcile privacy wording and counter retention; do not casually cascade-delete spending records.
6. Nickname validation permits Unicode combining marks with letters so accented names work; all lengths count code points. `invalid_input` has simple fallback copy because spec4.11 does not supply it.
7. `create-next-app` created an initial commit automatically, then each foundation task received its own commit. The installed superpowers execution skills were unavailable; followed the explicit task/test/check flow directly.
8. `npm install` reports 11 advisories (7 moderate, 4 high) for the exact planned dependency graph. No automatic dependency changes were made; QA should assess before deployment.

## Integration notes

- All later workstreams can begin. Shared files and package dependencies are frozen per orchestration.
- OpenAI provider in `src/lib/scoring/openai.ts` intentionally throws ScoringFailedError until workstream02 replaces it; no fake score is labelled AI.
- Root confirmed operator name **HanLog team** for the privacy page.
- Set both `SCORING_PROVIDER=mock` and `OPENAI_API_KEY=` explicitly in production E2E server environment so Next cannot enable network moderation from ignored local credentials.
- `getDb()` dynamically imports only the selected driver, caches the initialization promise on globalThis, and migrates/seeds PGlite automatically. Postgres requires the backend migration runner.
- `createTestDb()` seeds system user/sample challenges; count tests should filter appropriately.
- `tests/fixtures/api/samples.ts` contains stable six-mission fixtures even after content expands.
- `fetchMediaBlobUrl()` returns an object URL; callers must revoke it.
- No junction-specific restriction observed. The main checkout owns its node_modules directory; worktrees may junction to it while package.json stays frozen.

## Exports (tasks 2–9)

- `src/lib/api-client.ts`: `ApiClientError`, `api`.
- `src/lib/audio/wav.ts`: `WavInfo`, `WavErrorCode`, `WavError`, `parseWav`, `validateScoringWav`, `wavRms`, `encodeWavPcm16`, `wavToFloat32`, `resampleLinear`.
- `src/lib/config.ts`: `Config`, `getConfig`.
- `src/lib/content.ts`: `SampleChallenge`, `getMissions`, `getMission`, `getRewards`, `getSampleChallenges`, `todaysMissionIds`.
- `src/lib/contracts.ts`: `LIMITS`, `SHARE_CODE_ALPHABET`, `SYSTEM_USER_ID`, `countChars`, `containsHangul`, `hasLink`, `isValidNickname`, `RoleSchema`, `Role`, `UserSchema`, `User`, `MissionModeSchema`, `MissionMode`, `MissionSchema`, `Mission`, `MissionWithProgressSchema`, `MissionWithProgress`, `ScoreIssueSchema`, `ScoreIssue`, `ScoreSchema`, `Score`, `AttemptSchema`, `Attempt`, `AttemptResultSchema`, `AttemptResult`, `PointReasonSchema`, `PointReason`, `PointEventSchema`, `PointEvent`, `PointsSummarySchema`, `PointsSummary`, `RewardSchema`, `Reward`, `MediaKindSchema`, `MediaKind`, `MEDIA_TYPES`, `ChallengeScopeSchema`, `ChallengeScope`, `CreateChallengeFieldsSchema`, `ChallengeSchema`, `Challenge`, `RatingInputSchema`, `FeedbackInputSchema`, `PeerRatingSchema`, `PeerRating`, `PeerFeedbackSchema`, `PeerFeedback`, `ChallengeResponseSchema`, `ChallengeResponse`, `ViewerRoleSchema`, `ViewerRole`, `ChallengeDetailSchema`, `ChallengeDetail`, `ApiErrorCodeSchema`, `ApiErrorCode`, `ApiErrorBodySchema`, `ApiErrorBody`, `API_ERROR_STATUS`, `CreateSessionInputSchema`, `UpdateSessionInputSchema`.
- `src/lib/db/index.ts`: `Db`, `setDbForTests`, `getDb`, `createTestDb`.
- `src/lib/db/migrate.ts`: `applyMigrations`.
- `src/lib/db/pg.ts`: `createPgDb`.
- `src/lib/db/pglite.ts`: `createPgliteDb`.
- `src/lib/errors.ts`: `ERROR_MESSAGES`, `ApiError`.
- `src/lib/http.ts`: `json`, `errorResponse`, `assertSameOrigin`, `route`, `readJson`, `clientIpHash`, `kstDateString`, `kstDayStartIso`.
- `src/lib/repo/seed.ts`: `ensureSeed`.
- `src/lib/repo/users.ts`: `createUser`, `getUser`, `updateUser`, `countUsersSince`, `deleteUserCascade`.
- `src/lib/scoring/compose.ts`: `composeScore`.
- `src/lib/scoring/index.ts`: `getScoringProvider`, `scoreAttempt`.
- `src/lib/scoring/jamo.ts`: `normalizeHangul`, `jamoSimilarity`.
- `src/lib/scoring/mock.ts`: `mockProvider`.
- `src/lib/scoring/openai.ts`: `createOpenAiProvider`.
- `src/lib/scoring/types.ts`: `RawScore`, `RawScoreSchema`, `ScoringProvider`, `NoSpeechError`, `ScoringFailedError`.
- `src/lib/session.ts`: `SESSION_COOKIE`, `signSession`, `verifySession`, `getSessionUser`, `requireUser`, `sessionCookieHeader`, `clearSessionCookieHeader`.
- `tests/fixtures/api/samples.ts`: `samples`.
- `tests/helpers/api.ts`: `useTestDb`, `createTestUser`, `makeRequest`, `wavFile`.
- `tests/helpers/audio.ts`: `toneWav`, `silentWav`, `noiseWav`, `withListChunk`.

The `api` object supplies getSession, createSession, updateSession, deleteSession, listMissions, submitAttempt, getPoints, listRewards, listChallenges, createChallenge, getChallenge, submitResponse, rateResponse, giveFeedback, reportResponse, mediaUrl.response, mediaUrl.reference, and fetchMediaBlobUrl.

## Requests

- Scoring owns replacing the explicit OpenAI stub.
- Content owns expanding seeds and generating reference audio within the owner's spending authorization.
- Frontend/intro must follow the refreshed v0.4 token semantics above.
- Integration/QA owns final dependency advisory assessment and reconciliation of privacy/budget counter retention wording.
