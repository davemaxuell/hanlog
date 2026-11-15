# HanLog · 한로그

HanLog is a Korean speaking practice demo with 24 missions, voice/video recording, feedback, points, and peer challenges. Learners can answer Korean speakers and exchange ratings. Rewards are examples only; partners and redemption are not available.

Hosted demo: **https://hanlog-nine.vercel.app**.

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

The browser suite uses an in-memory database and separate `.data/e2e-media` folder. `E2E_SKIP_BUILD=1` is only for rerunning tests against an already-current production build.

## Deployment details

Source is in the private [davemaxuell/hanlog repository](https://github.com/davemaxuell/hanlog). The Vercel project is `hanlog` in `davemaxuell-1329s-projects`, using Node 24 and Seoul (`icn1`), and serves [hanlog-nine.vercel.app](https://hanlog-nine.vercel.app). `vercel.json` schedules expiry cleanup at 18:00 UTC daily. Public-route checks and the hosted private-media/deletion checks passed; the [QA handoff](docs/handoffs/qa.md) records the exact deployment and the limits of the AI verification.

The free Supabase project `hanlog-db` is provisioned in Seoul. All schema migrations are applied. The private `recordings` bucket passed upload, download, deletion, and anonymous-access refusal checks. PostgreSQL uses `DATABASE_CA_CERT` with strict certificate and hostname verification. Production has server-only database, storage, session, cleanup, and OpenAI configuration; configure Preview separately before using it.

Production scoring limits are 30 calls per user, 100 per network address, and 100 globally per Korea-time day. Failed provider calls also consume reservations. These production overrides are lower than the code defaults. The GitHub workflow runs Node 24 type checks, lint, tests, a mock production build, and bundle checks; deployment is handled separately through Vercel.

Set `SITE_URL` before building to the production origin, for example `https://your-domain.example`, without a path. Vercel system hosts provide a fallback. Preview builds use their own host and request no search indexing; private app and share-link pages also request no indexing. The share image includes its licensed local serif font and makes no font request at runtime.

The default smoke command only reads public routes. `node scripts/smoke.mjs <origin> --live --max-attempts=2` deliberately creates a temporary profile, submits one speech fixture and one silence check, checks points, and deletes the profile. It can invoke OpenAI scoring and nickname moderation, never retries, and stops after a failed live step. If deletion reports failure, retry deletion from that environment before treating the smoke as complete. The existing synthetic café fixture checks compatibility only; it is not evidence of pronunciation accuracy. Review future changes in a configured preview before production promotion.

The scoped `minimatch` override fixes a tooling advisory. The unused Vercel configuration SDK was replaced by static JSON, removing its vulnerable transitive dependencies. `npm audit` currently reports no vulnerabilities; review this again when updating packages.

See [project handoff](docs/HANDOFF.md), [device checklist](docs/device-check.md), [content review](docs/content-review.md), and [.env.example](.env.example). The source spec and ordered implementation plans are in [docs/superpowers](docs/superpowers/). The implemented palette is Open Window v0.4, Sky, Buttercream & Berry.
