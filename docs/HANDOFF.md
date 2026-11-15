# HanLog project handoff

Implementation finished locally on 16 November 2026, followed by a detail and reliability pass and hosted deployment at the owner's request. The demo is live at **https://hanlog-nine.vercel.app**. Public routes, private media, deletion, and one real AI request were checked, with the evidence limits recorded below. Calibration and owner reviews remain separate release work. The public operator name is **HanLog team**.

## What runs

`npm run demo` serves the production build at http://localhost:3000, with persistent local PGlite, local private media, signed browser sessions, and mock scoring. It explicitly disables OpenAI and remote storage even when local credentials exist. `npm run dev:demo` offers the same isolated settings with development reloads.

Implemented: public introduction and consent-gated trial; onboarding; 24 missions; voice and video capture, playback and voice-file fallback; score feedback; points and progress; eight sample challenges; posting, sharing, answering, replacing pending answers, authorized playback, rating, feedback and reports; rewards ledger; profile editing and role switching; data deletion; retention cleanup; privacy notice, icon and share image.

The six reward offers and redemption buttons are illustrative. Sample challenges are system-authored. Scores in the local demo are deterministic and visibly labelled “Demo scoring, not AI.” Reference audio is absent and Listen is hidden. User-created challenges, stored recordings, ratings, points and deletion are real local operations.

## Hosted environment

- Source: private [davemaxuell/hanlog](https://github.com/davemaxuell/hanlog) repository.
- Vercel: `hanlog` project in `davemaxuell-1329s-projects`, Node 24, Seoul (`icn1`), serving [hanlog-nine.vercel.app](https://hanlog-nine.vercel.app). The verified deployment was built from `1c2b5a8e362166b9023cff81a1e98da884af9be7`.
- Supabase: free `hanlog-db` project in Seoul. All schema migrations are applied. The `recordings` bucket is private; upload, download, deletion, and anonymous-access refusal were verified.
- PostgreSQL TLS: `DATABASE_CA_CERT` supplies the trusted CA; certificate and hostname verification remain enabled.
- Production scoring: the OpenAI key is configured as a server secret with `SCORING_PROVIDER=openai`. One hosted speech request returned HTTP 200 and the runtime log confirmed `gpt-audio-1.5`. Credentials are not stored in this handoff or the repository.
- GitHub Actions runs checks, a mock production build, and bundle verification on main and pull requests. [CI passed for the verified deployment commit `1c2b5a8`](https://github.com/davemaxuell/hanlog/actions/runs/43734569418); full deployment evidence is in [QA handoff](handoffs/qa.md).

## Verification

The integrated unit/API/component suite passes with 334 tests and 7 gated skips; the local production build passed during deployment preparation. Final counts and browser results are recorded in `docs/handoffs/qa.md`. Browser tests exercise production code with synthetic microphone/camera input; they are not real iPhone/Android or learner-pronunciation validation. Six concurrency cases have also passed against disposable local PostgreSQL 17: mission awards, scoring caps, peer ratings, profile deletion during answer and reference uploads, and incomplete-challenge cleanup while an answer commits.

Hosted checks also verified private recording upload/playback, refusal of anonymous access and silence, and profile deletion. After API deletion, direct SQL over verified TLS confirmed both temporary profiles and their attempts, points, answers, and pending media-deletion rows were gone; the test recording was absent from the private bucket.

Browser coverage includes guest consent and score carryover, onboarding, repeated mission awards, denied-microphone upload, profile deletion, a two-browser peer exchange with both balances, video answer delivery, cron authorization, security headers/cookies/origin checks, keyboard recording, width checks at 320/390/768/1440, and automated accessibility checks.

## Scoring evidence and spending

Before hosted verification, the recorded compatibility check made two paid requests: one 2.95-second café TTS fixture and one gpt-audio-1.5 scoring request. The scoring request succeeded in 3,165 ms with overall 88; its estimated charge was $0.0043655, excluding the TTS charge not reported by the binary response. No exact total bill is claimed. See [spike evidence](spike/2026-11-scoring-spike.md).

Hosted verification made exactly one additional speech-scoring request: HTTP 200 in 3,422 ms, with `gpt-audio-1.5` taking 2,987 ms and reporting 824 prompt tokens (29 audio, 795 text), 123 completion tokens, 947 total. The checker then read `body.score` instead of `body.attempt.score`, so no score threshold or awarded points were captured or verified. Its temporary profile was deleted with HTTP 204. The checker was corrected in `7a35ac6af6603e36949a88aed5a445b95c27e7e1` and all six offline smoke tests passed; no second hosted scoring request was made. This confirms the real AI integration, not pronunciation accuracy.

The model heard “아이씨” in place of “아이스” in that synthetic example. A single example establishes request compatibility, not pronunciation accuracy. Full A1–A7 acceptance, stability, ten-second latency, injection checks, eight remaining speech fixtures, and five consented learner samples remain pending. No fallback decision can be justified yet. Normal checks and the demo launcher make no paid calls.

## Data and limits

- Production scored attempts: 30 per user, 100 per address, 100 globally per Korea-time day. Code defaults remain 30, 600, and 1,500 respectively; production explicitly overrides the address and global caps. Failed provider calls consume reservations.
- New profiles: 200 per address per day. Challenge/answer/rating/feedback limits are enforced in the backend; see the source spec and configuration.
- Solo recordings are not stored by HanLog. Shared recordings expire after 14 days; delivery refuses expired files before cleanup runs.
- Deletion removes recordings before committing the database cascade. A storage error keeps identity and pointers for retry. Short-lived spending counters lose the deleted profile ID and are purged after their Korea-time day.
- The local launcher checks expiry on startup and hourly. Vercel confirms the deployed `/api/cron/cleanup` schedule is enabled at 18:00 UTC daily (03:00 Korea time). Vercel and Supabase resources are provisioned.

## Integration decisions

- Used the later, user-selected v0.4 design tokens instead of the stale warm palette table in the original spec.
- Merged green workstream checkpoints to let the introduction reuse the mission flow while later peer screens finished. All final branches were then integrated; final QA ran alone.
- Split profile and public assets into separate owned worktrees to finish faster.
- Limited Tailwind's loader to global CSS after a production-browser test found it stripping CSS Module class mappings. Added a rendered heading-size regression.
- Added scoped link underlining to the privacy page after an accessibility failure.
- Scoped migration file tracing explicitly to SQL, excluding private local files, tests and documents from server artifacts.
- Added `MEDIA_DIR` to isolate browser-test recordings and a zero-cost local launcher. Tests never use the owner's key or production database.
- Limited test workers to avoid exhausting this machine during concurrent checks.
- Security fixes include deletion/storage retry, reference-upload/deletion compensation, spending-counter detachment and expiry, and an onboarding session race guard.
- The detail pass fixes expired-session redirect loops, stale balance responses, discarded reference recordings, playback retries, microphone cleanup, empty answer lists and report focus. Rating targets are 48 pixels; private routes request no search indexing.
- Uploads are bounded before parsing. Peer media duration and audio/video tracks are inspected from the actual container; a 100ms encoding tail is allowed above 20 seconds, with stored/displayed duration capped to 20 seconds. Solo WAV limits are unchanged.
- A private pending-media cleanup queue records abandoned and replaced file paths and ownership durably. Account deletion includes queued recordings, and compensation rechecks committed references under file locks. All production migrations, including `002` and `003`, are applied.
- Scoring rejects incomplete, refused and ambiguous provider output and normalizes equivalent Korean Unicode. Evaluation does not pass when human or latency evidence is missing. Reference generation requires an explicit call budget and stops on service failure.
- Static `vercel.json` replaces the unused configuration SDK; a scoped `minimatch` override fixes the remaining tooling advisory. The dependency audit is clear.
- `SITE_URL` and Vercel host fallbacks set absolute metadata URLs. The share image bundles a licensed serif font. The deployment smoke script is read-only by default and requires `--live --max-attempts=2` for its temporary-profile scoring flow.
- Added trusted PostgreSQL CA support with certificate and hostname checks; URL TLS options cannot override it. Four regression tests cover this configuration.
- CI uses commit-pinned official GitHub actions and Node 24 with read-only repository permissions. `.vercelignore` excludes local secrets, runtime data, dependencies, generated output, tests, and documentation while retaining source assets and migrations.

## Deferred owner and release work

| Item | State |
| --- | --- |
| H1 OpenAI key | Configured privately in production. One hosted real-AI request returned HTTP 200; score and points were not captured because of the checker error. Account spending limit not verified. |
| H2 Supabase/Vercel | Live deployment, all migrations applied, private storage operations and deletion verified. Detailed deployment evidence is in the QA handoff. |
| H3 Native content review | Pending in `docs/content-review.md`. |
| H4 Five learner samples | Pending. |
| H5 Real iPhone/Android | Pending in `docs/device-check.md`. |
| H6 Operator name | Resolved: HanLog team. |
| Reference audio | Generator implemented/tested offline; bulk generation deferred. |
| Real PostgreSQL concurrency | Six tests passed against isolated PostgreSQL 17. They remain opt-in during ordinary tests. |
| Dependency advisories | Resolved; `npm audit` reports zero vulnerabilities after scoped fixes. |

Next: review Korean content, calibrate with consented learner samples and a small explicit budget, and complete real-device checks. Detailed changes and evidence are in `docs/handoffs/detail-ui.md`, `detail-server.md`, and `detail-scoring.md`.
