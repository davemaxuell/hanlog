# HanLog speaking demo: orchestration for build agents

This file tells a team of AI agents who builds what, in what order, and who owns which files. It contains no implementation tasks. Each workstream has its own plan file next to this one.

**Spec (read first, always):** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`

## Plan files

| # | File | Workstream | Wave | Agents |
|---|---|---|---|---|
| 01 | `2026-11-15-hanlog-01-foundation.md` | Repository, contracts, database, session, audio utilities, scoring core, API client | 1 | one, alone |
| 02 | `2026-11-15-hanlog-02-scoring.md` | OpenAI scoring spike, prompt, provider, evaluation | 2 | one |
| 03 | `2026-11-15-hanlog-03-backend.md` | All API routes, points, limits, moderation, media, cleanup | 2 | one or two (see the split inside) |
| 04 | `2026-11-15-hanlog-04-frontend.md` | Design primitives, recorder, every `/app` screen | 2 | one |
| 05 | `2026-11-15-hanlog-05-content.md` | Missions, sample challenges, rewards, reference clips | 2 | one, strong in Korean |
| 06 | `2026-11-15-hanlog-06-intro-site.md` | Introduction page, live try panel, privacy page | 2b | one, starts after frontend tasks 1 to 8 are merged |
| 07 | `2026-11-15-hanlog-07-qa-deploy.md` | End to end tests, accessibility, deployment, device checks, handoff docs | 3 | one, alone |

## Waves

```
Wave 1   01 foundation ──────────────► tag foundation-done
                                         │
Wave 2   ┌── 02 scoring ────────────────┤
         ├── 03 backend ────────────────┤
         ├── 04 frontend ──┬────────────┤
         ├── 05 content ───┼────────────┤
Wave 2b  │                 └─ 06 intro ─┤   (needs frontend tasks 1 to 8)
                                         ▼
Wave 3   07 QA and deploy  (needs all of the above merged)
```

Nothing in wave 2 waits on another wave 2 workstream, because wave 1 delivers the contracts, a working mock scorer, an in-process database, and a typed API client. Frontend builds against the API client with mocked responses; backend builds against the mock scorer; scoring builds behind the provider interface.

The only external blocker inside wave 2 is the OpenAI key (owner checkpoint H1) for plan 02. If the key is late, the scoring agent does tasks 2 and 3 first (they use a fake `fetch`) and waits only for task 1 and task 4.

## Ownership

An agent edits only the paths it owns. If a change is needed in someone else's path, write it down in `docs/handoffs/<workstream>.md` under "Requests" and keep going with a local workaround or a skipped test marked with the request.

| Workstream | Branch | Owns |
|---|---|---|
| 01 foundation | `main` | Everything it creates. After the tag `foundation-done` these become shared, read-only for others: `src/lib/contracts.ts`, `src/lib/config.ts`, `src/lib/errors.ts`, `src/lib/http.ts`, `src/lib/session.ts`, `src/lib/content.ts`, `src/lib/api-client.ts`, `src/lib/audio/wav.ts`, `src/lib/db/**`, `src/lib/repo/users.ts`, `src/lib/repo/seed.ts`, `src/lib/scoring/{types,jamo,compose,mock,index}.ts`, `db/migrations/0001_init.sql`, `package.json`, config files, `tests/helpers/**` |
| 02 scoring | `ws/scoring` | `src/lib/scoring/openai.ts`, `src/lib/scoring/prompt.ts`, `src/lib/scoring/transcribe.ts`, `scripts/spike-scoring.ts`, `scripts/gen-fixtures.ts`, `scripts/eval-scoring.ts`, `tests/unit/scoring/openai*.test.ts`, `tests/unit/scoring/prompt.test.ts`, `tests/fixtures/scoring/**`, `docs/spike/**` |
| 03 backend | `ws/backend` | `src/app/api/**`, `src/lib/points/**`, `src/lib/limits.ts`, `src/lib/moderation.ts`, `src/lib/media/**`, `src/lib/repo/{attempts,points,challenges,responses}.ts`, `scripts/migrate.ts`, `vercel.ts`, `tests/api/**`, `tests/unit/{points,limits,moderation,media}/**` |
| 04 frontend | `ws/frontend` | `src/components/{ui,recorder,mission,challenge}/**`, `src/app/app/**`, `src/app/c/**`, `src/lib/audio/to-wav.ts`, `src/lib/ui/**`, `tests/ui/**` except `tests/ui/intro/**` |
| 05 content | `ws/content` | `content/**`, `public/audio/missions/**`, `scripts/gen-reference-audio.ts`, `tests/unit/content/**` |
| 06 intro | `ws/intro` | `src/app/page.tsx`, `src/app/privacy/**`, `src/components/intro/**`, `src/app/{icon,opengraph-image}.*`, `tests/ui/intro/**` |
| 07 QA and deploy | `main` | `tests/e2e/**`, `playwright.config.ts`, `README.md`, `docs/HANDOFF.md`, `.env.example` updates |

`src/app/layout.tsx` and `src/app/globals.css` are created by foundation. Frontend may extend `globals.css` with component-level utilities; nobody else touches either file.

`package.json` is frozen after wave 1. Foundation installs every dependency the other plans need. If a wave 2 agent believes it needs a new package, it records a request and does without. Plan 07 may add test-only packages because it runs alone.

## Working rules for every agent

1. Read the spec in full, then your plan in full, before changing anything.
2. Work on your branch, in your own git worktree. Rebase on `main` before you ask for a merge.
3. Follow your plan task by task: write the failing test, watch it fail, implement, watch it pass, commit. One commit per task at minimum.
4. `npm run check` must pass before every commit that ends a task.
5. Never read, print, or commit secrets. Real keys live only in `.env.local`, which is ignored by git. Tests never need a real key except the two tasks that say so.
6. Development and tests run with no environment variables set at all. If something needs configuration to start, that is a bug.
7. Use the exact names, types, limits, and wording from the spec. If the spec is silent, choose the simplest thing and note the choice in your handoff file.
8. Next.js 16 differs from older versions. The scaffold writes an `AGENTS.md` that points to the bundled Next.js docs; read the relevant page there before using a framework API from memory. Route handler `params` is a promise. `cookies()` and `headers()` are async. Do not use the Edge runtime.
9. Interface text is English. Wrap Korean text in an element with `lang="ko"`.
10. When you finish, write `docs/handoffs/<workstream>.md`: what was built, what was verified and how, deviations from the plan with reasons, open requests to other workstreams.

Foundation appends rules 3 to 9 to the scaffolded `AGENTS.md` (plan 01, task 1) so later agents see them automatically.

## Merge protocol

The integrating agent (or the owner) merges finished branches into `main` in this order, running `npm run check` after each merge: `ws/content`, `ws/backend`, `ws/scoring`, `ws/frontend`, `ws/intro`. Ownership boundaries mean these merges should be conflict free. A conflict means someone left their lane: resolve in favor of the owner of the path.

After the last merge, run `npm run build` and start plan 07.

## Owner checkpoints

Defined in spec section 18. When they matter:

| Checkpoint | Blocks |
|---|---|
| H1 OpenAI key and spending limit | Plan 02 tasks 1 and 4, plan 05 task 3, plan 07 production smoke test |
| H2 Supabase and Vercel access | Plan 07 deployment tasks |
| H3 Native speaker content review | Plan 05 sign-off (not the merge) |
| H4 Five learner voice samples | Plan 02 threshold A6 only |
| H5 Real phone check | Plan 07 final task |
| H6 Operator name, footer credit | Plan 06 privacy page copy (a placeholder is used until answered) |

## Kickoff prompts

Paste one of these to start an agent. Replace nothing; the paths are relative to the repository root.

**Foundation**
> You are building the foundation of the HanLog speaking demo. Read `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, then `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`, then execute `docs/superpowers/plans/2026-11-15-hanlog-01-foundation.md` task by task with test-driven development. You are the only agent working right now, on `main`. Other agents will depend on the exact names and types you create, so match the plan and the spec exactly. Finish by tagging `foundation-done` and writing `docs/handoffs/foundation.md`.

**Scoring**
> You are building the AI scoring provider for the HanLog speaking demo. Read the spec at `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md` (sections 5 and 19 closely), then `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`, then execute `docs/superpowers/plans/2026-11-15-hanlog-02-scoring.md`. Work on branch `ws/scoring` in your own worktree and edit only the paths the orchestration file assigns to you. Tasks 1 and 4 call the real OpenAI API and need `OPENAI_API_KEY` in `.env.local`; if it is missing, do tasks 2 and 3 and then stop and say so. Finish with `docs/handoffs/scoring.md`.

**Backend**
> You are building the HTTP API of the HanLog speaking demo. Read the spec at `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md` (sections 6, 7, 9, 10, 11, 12 closely), then `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`, then execute `docs/superpowers/plans/2026-11-15-hanlog-03-backend.md`. Work on branch `ws/backend` in your own worktree and edit only the paths assigned to you. Everything is testable with no external services: the database is in-process and the scorer is a mock. Finish with `docs/handoffs/backend.md`.

**Frontend**
> You are building the product screens of the HanLog speaking demo. Read the spec at `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md` (sections 4, 9, 14 closely) and the design direction at `docs/design/open-window/DESIGN.md`, then `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`, then execute `docs/superpowers/plans/2026-11-15-hanlog-04-frontend.md`. Work on branch `ws/frontend` in your own worktree and edit only the paths assigned to you. Talk to the server only through `src/lib/api-client.ts`; mock that module in component tests. Design for a 390 px wide phone first. Finish with `docs/handoffs/frontend.md`.

**Content**
> You are writing the learning content of the HanLog speaking demo. You must be fluent in Korean as it is really spoken by university students in Seoul. Read the spec at `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md` (sections 1, 5.1, 13 closely), then `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`, then execute `docs/superpowers/plans/2026-11-15-hanlog-05-content.md`. Work on branch `ws/content` and edit only the paths assigned to you. Finish with `docs/handoffs/content.md`, including a list of every item you are less than sure a native speaker would approve.

**Intro site**
> You are building the public introduction page of the HanLog speaking demo. Read the spec at `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md` (sections 1, 2, 4.1, 12, 13, 14 closely) and `docs/design/open-window/DESIGN.md`, then `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`, then execute `docs/superpowers/plans/2026-11-15-hanlog-06-intro-site.md`. Start only after frontend tasks 1 to 8 are on `main`. Work on branch `ws/intro` and edit only the paths assigned to you. Reuse the recorder and score card components; do not copy them. Finish with `docs/handoffs/intro.md`.

**QA and deploy**
> You are integrating, testing, and deploying the HanLog speaking demo. All workstream branches are merged into `main`. Read the spec at `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, every file in `docs/handoffs/`, then execute `docs/superpowers/plans/2026-11-15-hanlog-07-qa-deploy.md`. You may fix defects you find in any path, with a test that shows the defect first. Deployment needs owner checkpoint H2; if access is missing, finish everything before the deployment tasks and then stop and say exactly what you need.

## Definition of done for the whole delivery

- `npm run check` and `npm run test:e2e` pass on `main`.
- The deployed URL serves the introduction page over HTTPS, the live try panel returns a score with `scoredBy: "ai"`, and a second device can complete the peer loop.
- Thresholds A1 to A5 in spec section 5.7 are recorded as passing in `docs/spike/`, or the documented fallback is in place and recorded.
- No secret is present in the repository or in any client bundle (plan 07 checks this).
- `docs/HANDOFF.md` describes what exists, what is mocked, and what is next.

## Known risks

| Risk | Where it is handled |
|---|---|
| The audio model is a weak or biased judge of Korean pronunciation | Plan 02 task 1 and task 4, thresholds in spec 5.7, fallbacks named there |
| Request options that the docs do not confirm (`modalities: ["text"]`, `strict`, forced tool choice) | Plan 02 task 1 tries variants and records the one that works |
| Safari records MP4 and decodes differently | Plan 04 task 2 converts through Web Audio; plan 07 device check |
| Classroom on one network trips address caps | Caps are loose by default and configurable (spec 11) |
| Slang goes stale or reads wrong | Owner checkpoint H3 |
| Non-ASCII repository path breaks tooling | Spec 16: move the folder |
| Text-to-speech models shut down on 2027-01-06 | Reference clips are generated once and committed (plan 05) |
