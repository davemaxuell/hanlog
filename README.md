# HanLog · 한록

HanLog is a Korean speaking practice app with 24 searchable missions, saved expressions, a practice journal, voice/video recording, AI feedback, and peer challenges. Learners can exchange recordings and ratings with Korean-speaking peers, track real progress, and restore their profile on another device. Points mark participation; commercial redemption is not available.

Public beta: **https://hanlog-nine.vercel.app**.

For presenting alongside the PowerPoint, open **[the product walkthrough](https://hanlog-nine.vercel.app/demo)**. It has four projector-friendly scenes, a local microphone check, real live practice, a clearly labelled example fallback, and an audience QR code. Follow the [three-minute presentation runbook](docs/demo-runbook.md).

Gentle motion and interaction feedback run throughout the app. **Reduce animations** in the footer or presentation toolbar remembers your browser preference and always respects device settings. See the [motion release notes](docs/handoffs/calm-motion.md).

## Run the finished local demo

Use Node 24. From this folder:

```sh
npm ci
npm run build
npm run demo
```

Open **http://localhost:3000**. No accounts or external services are needed. The demo launcher always uses clearly labelled mock scoring and disables OpenAI calls, including when `.env.local` contains a key.

For development, stop the running demo and use `npm run dev:demo`. Profiles and recordings persist in ignored `.data/demo-db` and `.data/demo-media`. The launcher runs expiry cleanup at startup and hourly while open. Stop with Ctrl+C.

## Real scoring

Production is configured with the server-only `OPENAI_API_KEY` and `SCORING_PROVIDER=openai`. One hosted speech request returned HTTP 200, with runtime logs confirming `gpt-audio-1.5`. The response score and points were not captured because of a smoke-checker response-path error, since fixed and tested offline; details are in the [QA handoff](docs/handoffs/qa.md). Pronunciation accuracy and calibration remain unverified. To deliberately enable real scoring locally, configure the server-only key in ignored `.env.local` and use the regular `npm run dev` command. This can make paid scoring and moderation calls; `demo` and `dev:demo` stay offline.

Diagnostic and reference-generation scripts default to dry runs and require explicit `--live` opt-in. They do not automatically load `.env.local`. Live reference generation also requires a `--max-calls` budget and stops on the first service failure. Reference clips were not bulk-generated under the owner's spending constraint.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run check` | TypeScript, lint, unit/API/component tests |
| `npm run test:e2e` | Production build and Chromium phone/desktop flows; mock scoring only |
| `npm run build` | Production build |
| `npm run check:bundle` | Check built browser files and tracked files for server secrets |
| `npm run spike:scoring` | Preview the guarded scoring compatibility check |
| `npm run eval:scoring` | Preview evaluation and report missing fixtures |
| `npm run content:audio` | Preview reference generation |
| `npm run db:migrate` | Migrate a configured PostgreSQL database |
| `node scripts/smoke.mjs <origin>` | Read-only deployment checks; no profiles or scoring calls |

The browser suite uses an in-memory database and separate `.data/e2e-media` folder. `E2E_SKIP_BUILD=1` is only for rerunning tests against an already-current production build. Recovery tests keep credentials in memory and disable traces/screenshots.

## Profiles and community operations

Profiles use a browser session rather than email/password. In **Me**, create and privately save a recovery key before changing devices or signing out. Restoring rotates the key and ends previous sessions; save its replacement. A dropped restore response can be retried on the same screen within five minutes. Only hashes are stored. Me also supports JSON export, key replacement, sign-out everywhere, and complete deletion.

Community reports have a private audit trail and a per-user daily cap. A challenge report hides it from that reporter's view; an answer report immediately hides its recording. The operator can inspect and resolve reports with `npx tsx scripts/review-community-reports.ts list`. The command defaults to a dry run and requires explicit `--apply` for PostgreSQL writes. See [community operations](docs/handoffs/community-launch.md).

## Deployment details

Source is in the private [davemaxuell/hanlog repository](https://github.com/davemaxuell/hanlog). The Vercel project is `hanlog` in `davemaxuell-1329s-projects`, using Node 24 and Seoul (`icn1`), and serves [hanlog-nine.vercel.app](https://hanlog-nine.vercel.app). `vercel.json` schedules expiry cleanup at 18:00 UTC daily. Public-route checks and the hosted private-media/deletion checks passed; the [QA handoff](docs/handoffs/qa.md) records the exact deployment and the limits of the AI verification.

The free Supabase project `hanlog-db` is provisioned in Seoul. All schema migrations are applied. The private `recordings` bucket passed upload, download, deletion, and anonymous-access refusal checks. PostgreSQL uses `DATABASE_CA_CERT` with strict certificate and hostname verification. Production has server-only database, storage, session, cleanup, and OpenAI configuration; configure Preview separately before using it.

Production scoring limits are 30 calls per user, 100 per network address, and 100 globally per Korea-time day. Failed provider calls also consume reservations. These production overrides are lower than the code defaults. The GitHub workflow runs Node 24 type checks, lint, tests, a mock production build, and bundle checks; deployment is handled separately through Vercel.

Set `SITE_URL` before building to the production origin, for example `https://your-domain.example`, without a path. Vercel system hosts provide a fallback. Preview builds use their own host and request no search indexing; private app and share-link pages also request no indexing. Licensed Paperlogy and Pretendard fonts are served locally; the share image includes its own Paperlogy font. The install manifest provides a home-screen experience without caching private API responses or recordings offline.

The default smoke command only reads public routes. `node scripts/smoke.mjs <origin> --live --max-attempts=2` deliberately creates a temporary profile, submits one speech fixture and one silence check, checks points, and deletes the profile. It can invoke OpenAI scoring and nickname moderation, never retries, and stops after a failed live step. If deletion reports failure, retry deletion from that environment before treating the smoke as complete. The existing synthetic café fixture checks compatibility only; it is not evidence of pronunciation accuracy. Review future changes in a configured preview before production promotion.

The scoped `minimatch` override fixes a tooling advisory. The unused Vercel configuration SDK was replaced by static JSON, removing its vulnerable transitive dependencies. `npm audit` currently reports no vulnerabilities; review this again when updating packages.

See the [current build audit](docs/handoffs/current-build-audit.md), [launch upgrade](docs/handoffs/launch-upgrade.md), [project handoff](docs/HANDOFF.md), [device checklist](docs/device-check.md), [content review](docs/content-review.md), and [.env.example](.env.example). The source spec and ordered implementation plans are in [docs/superpowers](docs/superpowers/). Open Window v0.5 follows the final project PowerPoint's navy, sky, buttercream, and pink palette, bold typography, and window motifs.
