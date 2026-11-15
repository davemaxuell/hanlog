# HanLog local demo handoff

Implementation finished locally on 16 November 2026. Public deployment, calibration and owner reviews were deferred at the owner's request to finish the working app first. The public operator name is **HanLog team**.

## What runs

`npm run demo` serves the production build at http://localhost:3000, with persistent local PGlite, local private media, signed browser sessions, and mock scoring. It explicitly disables OpenAI and remote storage even when local credentials exist. `npm run dev:demo` offers the same isolated settings with development reloads.

Implemented: public introduction and consent-gated trial; onboarding; 24 missions; voice and video capture, playback and voice-file fallback; score feedback; points and progress; eight sample challenges; posting, sharing, answering, replacing pending answers, authorized playback, rating, feedback and reports; rewards ledger; profile editing and role switching; data deletion; retention cleanup; privacy notice, icon and share image.

The six reward offers and redemption buttons are illustrative. Sample challenges are system-authored. Scores in the local demo are deterministic and visibly labelled “Demo scoring, not AI.” Reference audio is absent and Listen is hidden. User-created challenges, stored recordings, ratings, points and deletion are real local operations.

## Verification

The integrated unit/API/component suite and production build pass. Final counts and browser results are recorded in `docs/handoffs/qa.md`. Browser tests exercise production code with synthetic microphone/camera input; they are not real iPhone/Android or learner-pronunciation validation.

Browser coverage includes guest consent and score carryover, onboarding, repeated mission awards, denied-microphone upload, profile deletion, a two-browser peer exchange with both balances, video answer delivery, cron authorization, security headers/cookies/origin checks, keyboard recording, width checks at 320/390/768/1440, and automated accessibility checks.

## Scoring evidence and spending

Only two paid requests were made: one 2.95-second café TTS fixture and one gpt-audio-1.5 scoring request. The scoring request succeeded in 3,165 ms with overall 88; its estimated charge was $0.0043655, excluding the TTS charge not reported by the binary response. No exact total bill is claimed. See [spike evidence](spike/2026-11-scoring-spike.md).

The model heard “아이씨” in place of “아이스” in that synthetic example. A single example establishes request compatibility, not pronunciation accuracy. Full A1–A7 acceptance, stability, ten-second latency, injection checks, eight remaining speech fixtures, and five consented learner samples remain pending. No fallback decision can be justified yet. Normal checks and the demo launcher make no paid calls.

## Data and limits

- Scored attempts: 30 per user, 600 per address, 1,500 globally per Korea-time day. Failed provider calls consume reservations.
- New profiles: 200 per address per day. Challenge/answer/rating/feedback limits are enforced in the backend; see the source spec and configuration.
- Solo recordings are not stored by HanLog. Shared recordings expire after 14 days; delivery refuses expired files before cleanup runs.
- Deletion removes recordings before committing the database cascade. A storage error keeps identity and pointers for retry. Short-lived spending counters lose the deleted profile ID and are purged after their Korea-time day.
- The local launcher checks expiry on startup and hourly. Hosted Vercel configuration schedules cleanup at 18:00 UTC daily in Seoul. Hosting and Supabase storage have not been provisioned.

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

## Deferred owner and release work

| Item | State |
| --- | --- |
| H1 OpenAI key | Supplied privately; only the two small calls above used it. Account spending limit not verified. |
| H2 Supabase/Vercel | Not provisioned or deployed. No public preview or production URL. |
| H3 Native content review | Pending in `docs/content-review.md`. |
| H4 Five learner samples | Pending. |
| H5 Real iPhone/Android | Pending in `docs/device-check.md`. |
| H6 Operator name | Resolved: HanLog team. |
| Reference audio | Generator implemented/tested offline; bulk generation deferred. |
| Real PostgreSQL concurrency | Two opt-in tests remain skipped; Docker daemon was unavailable. |
| Dependency advisories | Exact planned graph reports 11 advisories (7 moderate, 4 high); assess before public release. No automatic version changes made. |

Next, in order: try the local app; review Korean content; calibrate with consented learner samples and a small explicit budget; complete real-device and PostgreSQL checks; provision a private preview and review it before production promotion.
