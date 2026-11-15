# HanLog · 한로그

HanLog is a Korean speaking practice demo with 24 missions, voice/video recording, feedback, points, and peer challenges. Learners can answer Korean speakers and exchange ratings. Rewards are examples only; partners and redemption are not available.

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

The OpenAI provider is implemented and passed one small compatibility check. Pronunciation accuracy and calibration remain unverified. To deliberately enable it, configure the server-only `OPENAI_API_KEY` in ignored `.env.local` and use the regular `npm run dev` command. This can make paid scoring and moderation calls; `demo` and `dev:demo` stay offline.

Diagnostic and reference-generation scripts default to dry runs and require explicit `--live` opt-in. They do not automatically load `.env.local`. Reference clips were not bulk-generated under the owner's spending constraint.

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

The browser suite uses an in-memory database and separate `.data/e2e-media` folder. `E2E_SKIP_BUILD=1` is only for rerunning tests against an already-current production build.

See [project handoff](docs/HANDOFF.md), [device checklist](docs/device-check.md), [content review](docs/content-review.md), and [.env.example](.env.example). The source spec and ordered implementation plans are in [docs/superpowers](docs/superpowers/). The implemented palette is Open Window v0.4, Sky, Buttercream & Berry.
