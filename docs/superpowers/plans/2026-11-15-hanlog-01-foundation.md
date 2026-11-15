# HanLog Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Next.js repository with shared contracts, an in-process database, sessions, audio utilities, a mock scorer, and a typed API client, so five other agents can build in parallel without waiting on each other.

**Architecture:** One Next.js 16 application with all logic in framework-neutral modules under `src/lib`. Persistence goes through a two-method `Db` interface backed by PGlite in development and tests. Scoring goes through a `ScoringProvider` interface with a deterministic mock.

**Tech Stack:** Next.js 16.4.6 (App Router, TypeScript, Tailwind CSS 4), zod 4, jose 6, PGlite 0.5, pg 8, Vitest 5, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`. Orchestration: `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`.

## Global Constraints

- Node.js 24, npm. Dependencies are pinned to exact versions (`--save-exact`). The lockfile is committed.
- Development and tests need zero environment variables.
- All names, types, limits, status codes, and wording come from spec sections 9, 10, and 11, copied exactly.
- `src/lib` never imports from `next/*`. Modules there use web-standard `Request`, `Response`, and plain data.
- Lengths count Unicode code points.
- No secrets in the repository. `.env*.local` and `.data/` are ignored by git.
- This plan installs every dependency the later plans need. After the tag `foundation-done`, `package.json` is frozen.

## Review Focus

1. A session cookie that is tampered with, expired, or names a deleted user must yield "no user", never an exception or a 500. Pinned in task 6.
2. A WAV file with extra chunks before `data`, or a `data` length that overstates the bytes present, must still parse to the true duration. Pinned in task 4.
3. Production with a missing `SESSION_SECRET` or `CRON_SECRET` must fail at startup with a message naming the variable, not run with a development default. Pinned in task 3.
4. Hot reload in development must not create a second database instance and lose data. Pinned in task 5.
5. Nicknames with Hangul, emoji, or combining characters must be measured in code points and rejected cleanly when out of range. Pinned in task 2.

---

### Task 1: Scaffold the repository

**Files:**
- Create: the Next.js scaffold, `vitest.config.ts`, `tests/helpers/ui-setup.ts`, `tests/unit/smoke.test.ts`, `tests/ui/smoke.test.tsx`, `.env.example`
- Modify: `package.json`, `next.config.ts`, `.gitignore`, `AGENTS.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `check`, `db:migrate`, `spike:scoring`, `eval:scoring`, `content:audio`. Import alias `@/*` to `src/*`. Vitest projects `node` and `ui`.

- [ ] **Step 1: Scaffold**

From the folder that contains `hanlog` (the folder currently holds only `docs/`):

```bash
npx create-next-app@16.4.6 hanlog --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-agent-feedback --yes
```

Expected: files created inside `hanlog`, a git repository initialized, `docs/` untouched. If the tool refuses because the folder is not empty, scaffold into `hanlog-scaffold`, move every file including dotfiles into `hanlog`, and delete `hanlog-scaffold`.

- [ ] **Step 2: Install pinned dependencies**

```bash
npm install --save-exact zod@4.6.7 jose@6.2.17 pg@8.23.1 @electric-sql/pglite@0.5.16 @supabase/supabase-js@2.119.0 @vercel/config@0.14.1
npm install --save-dev --save-exact vitest@5.1.0 @vitejs/plugin-react@6.3.0 jsdom@31.0.1 @testing-library/react@16.3.3 @testing-library/user-event@14.6.10 @testing-library/jest-dom@7.0.1 @playwright/test@1.65.1 tsx@4.23.15 @types/pg@8.23.1
```

Keep whatever TypeScript, React, Tailwind, and ESLint versions the scaffold installed.

- [ ] **Step 3: Configure**

- `next.config.ts`: add `serverExternalPackages: ['@electric-sql/pglite', 'pg']`.
- `vitest.config.ts`: alias `@` to `./src`. Two projects. `node`: environment `node`, include `tests/unit/**/*.test.ts` and `tests/api/**/*.test.ts`. `ui`: environment `jsdom`, React plugin, include `tests/ui/**/*.test.tsx`, setup file `tests/helpers/ui-setup.ts` that imports `@testing-library/jest-dom/vitest`.
- `package.json` scripts: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"test:e2e": "playwright test"`, `"check": "npm run typecheck && npm run lint && npm run test"`, `"db:migrate": "tsx scripts/migrate.ts"`, `"spike:scoring": "tsx scripts/spike-scoring.ts"`, `"eval:scoring": "tsx scripts/eval-scoring.ts"`, `"content:audio": "tsx scripts/gen-reference-audio.ts"`. Keep the scaffold's `dev`, `build`, `start`, `lint`.
- `.gitignore`: add `.data/`, `test-results/`, `playwright-report/`. Confirm `.env*.local` is ignored.
- `.env.example`: one line per variable in spec section 11, each with an empty value and a one-line comment.

- [ ] **Step 4: Smoke tests**

`tests/unit/smoke.test.ts`:

```ts
import { expect, it } from 'vitest';
it('runs in node', () => { expect(typeof process.version).toBe('string'); });
```

`tests/ui/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
it('renders in jsdom', () => {
  render(<p lang="ko">한로그</p>);
  expect(screen.getByText('한로그')).toBeInTheDocument();
});
```

- [ ] **Step 5: Append project rules to `AGENTS.md`**

Keep the scaffold's content. Append a section "HanLog project rules" containing rules 3 to 9 from the orchestration file, verbatim, plus the two lines: "Spec: docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md" and "Your lane: docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md, section Ownership".

- [ ] **Step 6: Verify**

Run: `npm run check && npm run build`
Expected: type check, lint, and 2 tests pass; build completes.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold HanLog app with test tooling"
```

---

### Task 2: Contracts

**Files:**
- Create: `src/lib/contracts.ts`
- Test: `tests/unit/contracts.test.ts`

**Interfaces:**
- Produces: every type in spec section 9.1 as an exported type and a zod schema named `<Type>Schema` (`UserSchema`, `MissionSchema`, `ScoreSchema`, `AttemptResultSchema`, `ChallengeSchema`, `ChallengeDetailSchema`, and so on). Also:
  - `LIMITS` exactly as spec section 9.2
  - `API_ERROR_STATUS: Record<ApiErrorCode, number>` exactly as spec section 9.1
  - `MEDIA_TYPES: Record<string, { kind: MediaKind; ext: 'webm' | 'mp4' | 'ogg' | 'wav' }>` for the six types in spec section 9.2
  - `SHARE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'`, `SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001'`
  - `countChars(s: string): number`, `containsHangul(s: string): boolean`, `isValidNickname(s: string): boolean`, `hasLink(s: string): boolean`
  - Input schemas: `CreateSessionInputSchema` (`nickname`, `role`, `consent: true`), `UpdateSessionInputSchema` (at least one of `nickname`, `role`), `CreateChallengeFieldsSchema` (`korean`, `meaningEn`, `situationEn`), `RatingInputSchema`, `FeedbackInputSchema`, `ChallengeScopeSchema`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  API_ERROR_STATUS, CreateChallengeFieldsSchema, CreateSessionInputSchema, FeedbackInputSchema, LIMITS,
  MEDIA_TYPES, MissionSchema, RatingInputSchema, UpdateSessionInputSchema,
  containsHangul, countChars, hasLink, isValidNickname,
} from '@/lib/contracts';

const mission = {
  id: 'cafe-iced-americano', mode: 'repeat', korean: '아이스 아메리카노 한 잔 주세요.', keyword: null,
  romanization: 'aiseu amerikano han jan juseyo', meaningEn: 'One iced americano, please.',
  situationEn: 's', promptEn: 'p', level: 1, basePoints: 10, referenceAudio: null, tags: ['cafe'],
};

describe('contracts', () => {
  it('counts code points and validates nicknames', () => {
    expect(countChars('한🙂a')).toBe(3);
    expect(isValidNickname('아이샤')).toBe(true);
    expect(isValidNickname('Leo_2-b.')).toBe(true);
    expect(isValidNickname('a')).toBe(false);
    expect(isValidNickname('x'.repeat(21))).toBe(false);
    expect(isValidNickname('bad<name>')).toBe(false);
    expect(isValidNickname('  ')).toBe(false);
  });
  it('detects Hangul and links', () => {
    expect(containsHangul('daebak 대박')).toBe(true);
    expect(containsHangul('daebak')).toBe(false);
    expect(hasLink('see www.example.com')).toBe(true);
    expect(hasLink('see https://x.y')).toBe(true);
    expect(hasLink('no link here')).toBe(false);
  });
  it('requires consent to be true', () => {
    expect(CreateSessionInputSchema.safeParse({ nickname: 'Aisha', role: 'learner', consent: true }).success).toBe(true);
    expect(CreateSessionInputSchema.safeParse({ nickname: 'Aisha', role: 'learner', consent: false }).success).toBe(false);
    expect(CreateSessionInputSchema.safeParse({ nickname: 'Aisha', role: 'admin', consent: true }).success).toBe(false);
  });
  it('needs at least one field to update a session', () => {
    expect(UpdateSessionInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateSessionInputSchema.safeParse({ role: 'korean' }).success).toBe(true);
  });
  it('validates missions', () => {
    expect(MissionSchema.safeParse(mission).success).toBe(true);
    expect(MissionSchema.safeParse({ ...mission, basePoints: 20 }).success).toBe(false);            // must equal level * 10
    expect(MissionSchema.safeParse({ ...mission, mode: 'use' }).success).toBe(false);                // use needs a keyword
    expect(MissionSchema.safeParse({ ...mission, mode: 'use', keyword: '대박' }).success).toBe(false); // keyword must appear in korean
    expect(MissionSchema.safeParse({ ...mission, keyword: '잔' }).success).toBe(false);              // repeat must have null keyword
  });
  it('validates challenge fields', () => {
    const ok = { korean: '오늘 점메추 좀 해 줘.', meaningEn: 'Recommend lunch.', situationEn: '' };
    expect(CreateChallengeFieldsSchema.safeParse(ok).success).toBe(true);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, korean: 'jeommechu' }).success).toBe(false);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, korean: '가'.repeat(61) }).success).toBe(false);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, meaningEn: '' }).success).toBe(false);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, situationEn: 'x'.repeat(201) }).success).toBe(false);
  });
  it('validates stars', () => {
    expect(RatingInputSchema.safeParse({ pronunciation: 5, naturalness: 1, comment: '' }).success).toBe(true);
    expect(RatingInputSchema.safeParse({ pronunciation: 0, naturalness: 3, comment: '' }).success).toBe(false);
    expect(RatingInputSchema.safeParse({ pronunciation: 4.5, naturalness: 3, comment: '' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ helpfulness: 6, comment: '' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ helpfulness: 3, comment: 'x'.repeat(201) }).success).toBe(false);
  });
  it('pins limits, statuses, and media types', () => {
    expect(LIMITS.scoringWav).toEqual({ sampleRate: 16000, minMs: 500, maxMs: 20000, maxBytes: 700_000 });
    expect(LIMITS.peerMedia).toEqual({ maxBytes: 4_000_000, maxMs: 20000 });
    expect(LIMITS.recorder).toEqual({ maxSeconds: 15, minMs: 500 });
    expect(LIMITS.silenceRms).toBe(0.01);
    expect(API_ERROR_STATUS.no_speech).toBe(422);
    expect(API_ERROR_STATUS.budget_exhausted).toBe(503);
    expect(API_ERROR_STATUS.audio_too_large).toBe(413);
    expect(Object.keys(API_ERROR_STATUS)).toHaveLength(15);
    expect(MEDIA_TYPES['video/mp4']).toEqual({ kind: 'video', ext: 'mp4' });
    expect(Object.keys(MEDIA_TYPES).sort()).toEqual(['audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/contracts.test.ts`
Expected: FAIL, cannot resolve `@/lib/contracts`.

- [ ] **Step 3: Implement `src/lib/contracts.ts`**

Write the schemas for every type in spec section 9.1 and the exports listed under Interfaces. String fields that have a limit in `LIMITS` are trimmed first and measured with `countChars`. Timestamps are ISO strings. Ids are UUID strings except `Mission.id` and `Reward.id` (slugs).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/contracts.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts.ts tests/unit/contracts.test.ts && git commit -m "feat: shared contracts, limits, and validators"
```

---

### Task 3: Configuration, errors, HTTP helpers

**Files:**
- Create: `src/lib/config.ts`, `src/lib/errors.ts`, `src/lib/http.ts`
- Test: `tests/unit/config.test.ts`, `tests/unit/http.test.ts`

**Interfaces:**
- Consumes: `ApiErrorCode`, `API_ERROR_STATUS` from task 2.
- Produces:

```ts
// config.ts
export type Config = {
  isProd: boolean;
  sessionSecret: string;
  dbDriver: 'pglite' | 'pg'; databaseUrl: string | null; pgliteDir: string | null;
  mediaDriver: 'local' | 'supabase'; mediaDir: string; supabaseUrl: string | null; supabaseSecretKey: string | null; mediaBucket: string;
  scoringProvider: 'mock' | 'openai'; openaiApiKey: string | null; scoringModel: string;
  moderation: 'openai' | 'rules';
  limits: { userDailyAttempts: number; ipDailyAttempts: number; globalDailyAttempts: number; ipDailySessions: number };
  retentionDays: number;
  cronSecret: string | null;
};
export function getConfig(env?: Record<string, string | undefined>): Config; // defaults to process.env

// errors.ts
export class ApiError extends Error { readonly code: ApiErrorCode; constructor(code: ApiErrorCode, message?: string); }

// http.ts
export function json(data: unknown, init?: ResponseInit): Response;
export function errorResponse(e: unknown): Response;
export function route<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>): (req: Request, ctx: C) => Promise<Response>;
export function assertSameOrigin(req: Request): void;
export function readJson<T>(req: Request, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }): Promise<T>;
export function clientIpHash(req: Request): string;
export function kstDayStartIso(now?: Date): string;
export function kstDateString(now?: Date): string;
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/config.test.ts`:

```ts
import { expect, it } from 'vitest';
import { getConfig } from '@/lib/config';

const secret = 'x'.repeat(32);

it('defaults to local everything', () => {
  const c = getConfig({});
  expect(c).toMatchObject({
    isProd: false, dbDriver: 'pglite', databaseUrl: null, pgliteDir: null,
    mediaDriver: 'local', mediaDir: '.data/media', mediaBucket: 'recordings',
    scoringProvider: 'mock', scoringModel: 'gpt-audio-1.5', moderation: 'rules',
    retentionDays: 14, cronSecret: null,
  });
  expect(c.limits).toEqual({ userDailyAttempts: 30, ipDailyAttempts: 600, globalDailyAttempts: 1500, ipDailySessions: 200 });
  expect(c.sessionSecret.length).toBeGreaterThanOrEqual(32);
});
it('fails fast in production without secrets', () => {
  expect(() => getConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/);
  expect(() => getConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  expect(() => getConfig({ NODE_ENV: 'production', SESSION_SECRET: secret })).toThrow(/CRON_SECRET/);
  expect(getConfig({ NODE_ENV: 'production', SESSION_SECRET: secret, CRON_SECRET: 'c' }).isProd).toBe(true);
});
it('selects drivers from the environment', () => {
  expect(getConfig({ DATABASE_URL: 'postgres://a' }).dbDriver).toBe('pg');
  expect(getConfig({ POSTGRES_URL: 'postgres://b' }).databaseUrl).toBe('postgres://b');
  expect(getConfig({ SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }).mediaDriver).toBe('supabase');
  expect(getConfig({ SUPABASE_URL: 'u' }).mediaDriver).toBe('local');
  expect(getConfig({ OPENAI_API_KEY: 'k' })).toMatchObject({ scoringProvider: 'openai', moderation: 'openai' });
  expect(getConfig({ OPENAI_API_KEY: 'k', SCORING_PROVIDER: 'mock' }).scoringProvider).toBe('mock');
  expect(() => getConfig({ SCORING_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
});
it('refuses to run on Vercel with stores that would lose data', () => {
  const base = { VERCEL: '1', NODE_ENV: 'production', SESSION_SECRET: secret, CRON_SECRET: 'c' };
  expect(() => getConfig(base)).toThrow(/DATABASE_URL/);
  expect(() => getConfig({ ...base, DATABASE_URL: 'postgres://a' })).toThrow(/SUPABASE_URL/);
  expect(() => getConfig({ ...base, DATABASE_URL: 'postgres://a', SUPABASE_URL: 'u' })).toThrow(/SUPABASE_SECRET_KEY/);
  expect(getConfig({ ...base, DATABASE_URL: 'postgres://a', SUPABASE_URL: 'u', SUPABASE_SECRET_KEY: 'k' })).toMatchObject({ dbDriver: 'pg', mediaDriver: 'supabase' });
});
it('reads numeric overrides and rejects nonsense', () => {
  expect(getConfig({ USER_DAILY_ATTEMPTS: '5', RETENTION_DAYS: '7' })).toMatchObject({ limits: { userDailyAttempts: 5 }, retentionDays: 7 });
  expect(() => getConfig({ USER_DAILY_ATTEMPTS: 'many' })).toThrow(/USER_DAILY_ATTEMPTS/);
});
```

`tests/unit/http.test.ts`:

```ts
import { expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { assertSameOrigin, clientIpHash, errorResponse, json, kstDateString, kstDayStartIso, readJson, route } from '@/lib/http';
import { RatingInputSchema } from '@/lib/contracts';

const post = (headers: Record<string, string>, body?: string) =>
  new Request('https://hanlog.test/api/x', { method: 'POST', headers: { host: 'hanlog.test', ...headers }, body });

it('maps ApiError to status and body', async () => {
  const res = errorResponse(new ApiError('daily_limit'));
  expect(res.status).toBe(429);
  expect((await res.json()).error.code).toBe('daily_limit');
});
it('hides unknown errors', async () => {
  const res = errorResponse(new Error('db password is hunter2'));
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body.error.code).toBe('internal');
  expect(JSON.stringify(body)).not.toContain('hunter2');
});
it('route() converts throws and checks origin on writes', async () => {
  const handler = route(async () => json({ ok: true }, { status: 201 }));
  expect((await handler(post({ origin: 'https://hanlog.test' }), {})).status).toBe(201);
  expect((await handler(post({ origin: 'https://evil.test' }), {})).status).toBe(403);
  expect((await handler(post({}), {})).status).toBe(201); // no Origin header: allowed
  const failing = route(async () => { throw new ApiError('not_found'); });
  expect((await failing(new Request('https://hanlog.test/api/x'), {})).status).toBe(404);
});
it('assertSameOrigin ignores GET', () => {
  expect(() => assertSameOrigin(new Request('https://hanlog.test/api/x', { headers: { origin: 'https://evil.test', host: 'hanlog.test' } }))).not.toThrow();
});
it('readJson rejects bad bodies as invalid_input', async () => {
  await expect(readJson(post({ 'content-type': 'application/json' }, '{not json'), RatingInputSchema)).rejects.toMatchObject({ code: 'invalid_input' });
  await expect(readJson(post({ 'content-type': 'application/json' }, '{"pronunciation":9}'), RatingInputSchema)).rejects.toMatchObject({ code: 'invalid_input' });
});
it('hashes the client address', () => {
  const a = clientIpHash(new Request('https://h.test', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }));
  const b = clientIpHash(new Request('https://h.test', { headers: { 'x-forwarded-for': '9.9.9.9' } }));
  expect(a).toMatch(/^[0-9a-f]{32}$/);
  expect(a).not.toBe(b);
  expect(a).not.toContain('1.2.3.4');
  expect(clientIpHash(new Request('https://h.test'))).toBe('unknown');
});
it('computes the Korea-time day', () => {
  expect(kstDayStartIso(new Date('2026-11-15T16:30:00Z'))).toBe('2026-11-15T15:00:00.000Z');
  expect(kstDayStartIso(new Date('2026-11-15T14:59:59Z'))).toBe('2026-11-14T15:00:00.000Z');
  expect(kstDateString(new Date('2026-11-15T16:30:00Z'))).toBe('2026-11-16');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/config.test.ts tests/unit/http.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three modules**

Notes the tests do not decide:
- `getConfig` treats `NODE_ENV === 'production'` as production. The development `sessionSecret` is the constant `'dev-only-session-secret-change-me-0000'`. `SUPABASE_SECRET_KEY` takes precedence over `SUPABASE_SERVICE_ROLE_KEY`; `DATABASE_URL` over `POSTGRES_URL`. `pgliteDir` comes from `PGLITE_DIR`.
- `ApiError` default messages are short, user-safe English sentences per code.
- `route` runs `assertSameOrigin` for every method except `GET` and `HEAD`, then the handler, and converts any throw with `errorResponse`. Unknown errors are logged with `console.error` (message and stack only).
- `assertSameOrigin` compares the host of the `Origin` header with the `Host` header (falling back to the request URL host). A missing `Origin` passes.
- `clientIpHash` is SHA-256 of the first `x-forwarded-for` entry plus `sessionSecret`, first 32 hex characters.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/config.test.ts tests/unit/http.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/errors.ts src/lib/http.ts tests/unit/config.test.ts tests/unit/http.test.ts && git commit -m "feat: configuration, API errors, and HTTP helpers"
```

---

### Task 4: WAV utilities

**Files:**
- Create: `src/lib/audio/wav.ts`, `tests/helpers/audio.ts`
- Test: `tests/unit/audio/wav.test.ts`

**Interfaces:**
- Consumes: `LIMITS.scoringWav` from task 2.
- Produces:

```ts
// src/lib/audio/wav.ts  (no Node or DOM APIs: runs in the browser and on the server)
export type WavInfo = { sampleRate: number; channels: number; bitsPerSample: number; durationMs: number; dataOffset: number; dataLength: number };
export type WavErrorCode = 'not_wav' | 'unsupported' | 'too_short' | 'too_long' | 'too_large';
export class WavError extends Error { readonly code: WavErrorCode; }
export function parseWav(bytes: Uint8Array): WavInfo;             // throws not_wav | unsupported
export function validateScoringWav(bytes: Uint8Array): WavInfo;   // also too_large, too_short, too_long, and unsupported unless PCM 16-bit mono 16000 Hz
export function wavRms(bytes: Uint8Array): number;                // 0..1 over 16-bit samples
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array; // mono, canonical 44-byte header
export function wavToFloat32(bytes: Uint8Array): { samples: Float32Array; sampleRate: number }; // PCM 16-bit; multi-channel is averaged to mono
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array; // linear interpolation; same rate returns a copy

// tests/helpers/audio.ts
export function toneWav(ms: number, opts?: { sampleRate?: number; amplitude?: number; hz?: number }): Uint8Array; // defaults 16000, 0.5, 440
export function silentWav(ms: number): Uint8Array;
export function noiseWav(ms: number, amplitude?: number): Uint8Array; // seeded pseudo-random, default amplitude 0.3
export function withListChunk(wav: Uint8Array): Uint8Array;           // inserts a LIST chunk between fmt and data
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { WavError, encodeWavPcm16, parseWav, resampleLinear, validateScoringWav, wavRms, wavToFloat32 } from '@/lib/audio/wav';
import { silentWav, toneWav, withListChunk } from '../../helpers/audio';

const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as WavError).code; } return null; };

it('round-trips a tone', () => {
  const wav = toneWav(1500);
  expect(wav.length).toBe(44 + 1500 * 32);
  expect(parseWav(wav)).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 1500, dataOffset: 44 });
  expect(validateScoringWav(wav).durationMs).toBe(1500);
});
it('measures loudness', () => {
  expect(wavRms(toneWav(1000, { amplitude: 0.5 }))).toBeCloseTo(0.5 / Math.SQRT2, 1);
  expect(wavRms(silentWav(1000))).toBe(0);
});
it('rejects what scoring cannot use', () => {
  expect(code(() => validateScoringWav(new Uint8Array([1, 2, 3])))).toBe('not_wav');
  expect(code(() => validateScoringWav(toneWav(300)))).toBe('too_short');
  expect(code(() => validateScoringWav(toneWav(21000)))).toBe('too_long');
  expect(code(() => validateScoringWav(toneWav(22000)))).toBe('too_large');
  expect(code(() => validateScoringWav(toneWav(1000, { sampleRate: 44100 })))).toBe('unsupported');
});
it('parses files with extra chunks before data', () => {
  expect(parseWav(withListChunk(toneWav(1000))).durationMs).toBe(1000);
});
it('trusts the bytes present over the header', () => {
  const wav = toneWav(1000);
  const truncated = wav.slice(0, 44 + 500 * 32); // header still claims 1000 ms
  expect(parseWav(truncated).durationMs).toBe(500);
});
it('clips out-of-range samples when encoding', () => {
  const wav = encodeWavPcm16(new Float32Array([2, -2, 0]), 16000);
  const view = new DataView(wav.buffer, 44);
  expect([view.getInt16(0, true), view.getInt16(2, true), view.getInt16(4, true)]).toEqual([32767, -32768, 0]);
});
it('decodes and resamples', () => {
  const { samples, sampleRate } = wavToFloat32(toneWav(1000, { sampleRate: 24000 }));
  expect(sampleRate).toBe(24000);
  expect(samples).toHaveLength(24000);
  const down = resampleLinear(samples, 24000, 16000);
  expect(down).toHaveLength(16000);
  expect(validateScoringWav(encodeWavPcm16(down, 16000)).durationMs).toBe(1000);
  const flat = resampleLinear(new Float32Array(300).fill(0.25), 48000, 16000);
  expect(flat).toHaveLength(100);
  expect([...flat].every((v) => Math.abs(v - 0.25) < 1e-6)).toBe(true);
  expect([...resampleLinear(new Float32Array([0.1, 0.2]), 16000, 16000)]).toEqual([...new Float32Array([0.1, 0.2])]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/audio/wav.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `tests/helpers/audio.ts` and `src/lib/audio/wav.ts`**

`parseWav` walks RIFF chunks (each padded to an even length) until it finds `fmt ` and `data`; format tag must be 1 (PCM), otherwise `unsupported`. `validateScoringWav` checks size first, then format, then duration. `wavRms` reads only the `data` chunk. `resampleLinear` output length is `round(length * toRate / fromRate)`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/audio/wav.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/wav.ts tests/helpers/audio.ts tests/unit/audio/wav.test.ts && git commit -m "feat: WAV parsing, validation, loudness, and encoding"
```

---

### Task 5: Database layer and schema

**Files:**
- Create: `src/lib/db/index.ts`, `src/lib/db/pglite.ts`, `src/lib/db/pg.ts`, `src/lib/db/migrate.ts`, `db/migrations/0001_init.sql`
- Test: `tests/unit/db/db.test.ts`

**Interfaces:**
- Consumes: `getConfig` from task 3.
- Produces:

```ts
// src/lib/db/index.ts
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;   // commits on return, rolls back on throw; a tx inside a tx joins the outer one
}
export function getDb(): Promise<Db>;                                // process-wide singleton kept on globalThis
export function createTestDb(): Promise<Db & { close(): Promise<void> }>; // fresh in-memory PGlite, migrated
export function setDbForTests(db: Db | null): void;                  // getDb() returns this while set

// src/lib/db/migrate.ts
export function applyMigrations(db: Db, dir?: string): Promise<string[]>; // default 'db/migrations'; returns the file names it applied
```

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTestDb, getDb, setDbForTests, type Db } from '@/lib/db';
import { applyMigrations } from '@/lib/db/migrate';

let db: Db & { close(): Promise<void> };
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { setDbForTests(null); await db.close(); });

it('creates every table in schema hanlog with row level security on', async () => {
  const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'hanlog' and c.relkind = 'r' order by c.relname`);
  expect(rows.map((r) => r.relname)).toEqual(['attempts', 'challenge_responses', 'challenges', 'point_events', 'schema_migrations', 'scoring_calls', 'users']);
  expect(rows.filter((r) => r.relname !== 'schema_migrations').every((r) => r.relrowsecurity)).toBe(true);
});
it('is idempotent', async () => {
  expect(await applyMigrations(db)).toEqual([]);
});
it('rolls back a failed transaction', async () => {
  await expect(db.tx(async (t) => {
    await t.query(`insert into hanlog.users (nickname, role, ip_hash) values ($1, 'learner', 'x')`, ['a']);
    throw new Error('boom');
  })).rejects.toThrow('boom');
  expect((await db.query<{ n: number }>(`select count(*)::int as n from hanlog.users where nickname = 'a'`))[0].n).toBe(0);
});
it('joins nested transactions', async () => {
  await expect(db.tx(async (outer) => {
    await outer.tx(async (inner) => { await inner.query(`insert into hanlog.users (nickname, role, ip_hash) values ('b', 'korean', 'x')`); });
    throw new Error('outer fails');
  })).rejects.toThrow('outer fails');
  expect((await db.query<{ n: number }>(`select count(*)::int as n from hanlog.users where nickname = 'b'`))[0].n).toBe(0);
});
it('enforces checks', async () => {
  await expect(db.query(`insert into hanlog.users (nickname, role, ip_hash) values ('c', 'admin', 'x')`)).rejects.toThrow();
});
it('getDb returns the test database while set, and one shared instance otherwise', async () => {
  setDbForTests(db);
  expect(await getDb()).toBe(db);
  setDbForTests(null);
  const [a, b] = await Promise.all([getDb(), getDb()]);
  expect(a).toBe(b);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/db/db.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `db/migrations/0001_init.sql`**

Copy the SQL in spec section 10 exactly. After the tables, add one `alter table hanlog.<name> enable row level security;` per table.

- [ ] **Step 4: Implement the database modules**

- `migrate.ts`: creates `hanlog.schema_migrations (name text primary key, applied_at timestamptz not null default now())` if missing (after `create schema if not exists hanlog`), then applies each `*.sql` file in name order that is not yet recorded, each in its own transaction.
- `pglite.ts`: wraps `PGlite` (`new PGlite()` for memory, `new PGlite(dir)` for a folder) as a `Db`.
- `pg.ts`: wraps a `pg.Pool` (`max: 5`) as a `Db`; `tx` checks out one client and issues `BEGIN`, `COMMIT`, `ROLLBACK`. Loaded with a dynamic import only when `dbDriver` is `pg`, so PGlite is never imported in production and the reverse.
- `index.ts`: `getDb` stores its promise on `globalThis.__hanlogDb` so a hot reload reuses it. For PGlite it applies migrations on first use, with `pgliteDir` defaulting to `.data/pglite` when `NODE_ENV` is `development` and to memory otherwise. For `pg` it does not migrate.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/db/db.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db db/migrations tests/unit/db && git commit -m "feat: Db interface, PGlite and pg drivers, initial schema"
```

---

### Task 6: Users, sessions, and API test helpers

**Files:**
- Create: `src/lib/repo/users.ts`, `src/lib/session.ts`, `tests/helpers/api.ts`
- Test: `tests/unit/session.test.ts`, `tests/unit/repo/users.test.ts`

**Interfaces:**
- Consumes: `getDb`, `createTestDb`, `setDbForTests` (task 5); `ApiError` (task 3); `User`, `Role` (task 2).
- Produces:

```ts
// src/lib/repo/users.ts
export function createUser(input: { nickname: string; role: Role; ipHash: string }): Promise<User>;
export function getUser(id: string): Promise<User | null>;           // null for unknown or malformed ids
export function updateUser(id: string, patch: { nickname?: string; role?: Role }): Promise<User>; // ApiError('not_found')
export function countUsersSince(ipHash: string, sinceIso: string): Promise<number>;
export function deleteUserCascade(id: string): Promise<string[]>;    // returns stored media paths that must now be removed

// src/lib/session.ts
export const SESSION_COOKIE = 'hl_session';
export function signSession(userId: string): Promise<string>;
export function verifySession(token: string): Promise<string | null>;
export function getSessionUser(req: Request): Promise<User | null>;
export function requireUser(req: Request): Promise<User>;            // ApiError('unauthenticated')
export function sessionCookieHeader(token: string): string;          // a Set-Cookie header value
export function clearSessionCookieHeader(): string;

// tests/helpers/api.ts
export function useTestDb(): void;   // registers beforeEach/afterEach: fresh createTestDb() installed with setDbForTests
export function createTestUser(role?: Role, nickname?: string): Promise<{ user: User; cookie: string }>; // cookie is "hl_session=<token>"
export function makeRequest(method: string, path: string, opts?: { cookie?: string; json?: unknown; form?: FormData; headers?: Record<string, string> }): Request; // base http://localhost:3000, sets host and, for writes, a matching origin
export function wavFile(bytes: Uint8Array, name?: string): File;     // type audio/wav
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/session.test.ts`:

```ts
import { expect, it } from 'vitest';
import { SESSION_COOKIE, clearSessionCookieHeader, getSessionUser, requireUser, sessionCookieHeader, signSession, verifySession } from '@/lib/session';
import { deleteUserCascade } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';

useTestDb();

it('signs and verifies', async () => {
  const id = '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11';
  const token = await signSession(id);
  expect(await verifySession(token)).toBe(id);
  expect(await verifySession(token.slice(0, -2) + 'xx')).toBeNull();
  expect(await verifySession('garbage')).toBeNull();
  expect(await verifySession('')).toBeNull();
});
it('resolves the user from the cookie among other cookies', async () => {
  const { user, cookie } = await createTestUser('learner', '아이샤');
  const found = await getSessionUser(makeRequest('GET', '/api/session', { cookie: `theme=dark; ${cookie}; x=1` }));
  expect(found).toEqual(user);
});
it('treats missing, forged, and orphaned sessions as no user', async () => {
  expect(await getSessionUser(makeRequest('GET', '/api/session'))).toBeNull();
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie: `${SESSION_COOKIE}=forged` }))).toBeNull();
  const { user, cookie } = await createTestUser();
  await deleteUserCascade(user.id);
  expect(await getSessionUser(makeRequest('GET', '/api/session', { cookie }))).toBeNull();
  await expect(requireUser(makeRequest('GET', '/api/points'))).rejects.toMatchObject({ code: 'unauthenticated' });
});
it('builds cookie headers', () => {
  const set = sessionCookieHeader('tok');
  expect(set).toContain('hl_session=tok');
  for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=7776000']) expect(set).toContain(part);
  expect(set).not.toContain('Secure');           // not production in tests
  expect(clearSessionCookieHeader()).toContain('Max-Age=0');
});
```

`tests/unit/repo/users.test.ts`:

```ts
import { expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { countUsersSince, createUser, deleteUserCascade, getUser, updateUser } from '@/lib/repo/users';
import { useTestDb } from '../../helpers/api';

useTestDb();

it('creates, reads, and updates', async () => {
  const u = await createUser({ nickname: 'Aisha', role: 'learner', ipHash: 'h1' });
  expect(u).toMatchObject({ nickname: 'Aisha', role: 'learner' });
  expect(u.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  expect(await getUser(u.id)).toEqual(u);
  expect((await updateUser(u.id, { role: 'korean' })).role).toBe('korean');
  expect(await getUser('not-a-uuid')).toBeNull();
  await expect(updateUser('3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11', { nickname: 'x' })).rejects.toMatchObject({ code: 'not_found' });
});
it('counts users per address since a time', async () => {
  await createUser({ nickname: 'a1', role: 'learner', ipHash: 'h1' });
  await createUser({ nickname: 'a2', role: 'learner', ipHash: 'h1' });
  await createUser({ nickname: 'b1', role: 'learner', ipHash: 'h2' });
  expect(await countUsersSince('h1', '2000-01-01T00:00:00.000Z')).toBe(2);
  expect(await countUsersSince('h1', '2999-01-01T00:00:00.000Z')).toBe(0);
});
it('deletes a user with everything they own and reports media paths', async () => {
  const db = await getDb();
  const author = await createUser({ nickname: 'Minji', role: 'korean', ipHash: 'h' });
  const learner = await createUser({ nickname: 'Aisha', role: 'learner', ipHash: 'h' });
  const [{ id: challengeId }] = await db.query<{ id: string }>(
    `insert into hanlog.challenges (code, author_id, korean, meaning_en, reference_path, reference_mime)
     values ('ABC234', $1, '대박', 'wow', 'references/c1.webm', 'audio/webm') returning id`, [author.id]);
  await db.query(
    `insert into hanlog.challenge_responses (challenge_id, responder_id, media_path, media_kind, media_mime, duration_ms)
     values ($1, $2, 'responses/r1.webm', 'audio', 'audio/webm', 3000)`, [challengeId, learner.id]);
  const paths = await deleteUserCascade(author.id);
  expect(paths.sort()).toEqual(['references/c1.webm', 'responses/r1.webm']);
  expect(await getUser(author.id)).toBeNull();
  expect((await db.query<{ n: number }>('select count(*)::int as n from hanlog.challenge_responses'))[0].n).toBe(0);
  expect(await getUser(learner.id)).not.toBeNull();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/session.test.ts tests/unit/repo/users.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the three files**

Session tokens are JWTs signed with HS256 using `jose`, subject claim is the user id, expiry 90 days. `sessionCookieHeader` adds `Secure` only when `getConfig().isProd`. `deleteUserCascade` collects, before deleting, the non-null `reference_path` of the user's challenges, the `media_path` of answers to those challenges, and the `media_path` of the user's own answers. Repositories map snake_case columns to the camelCase types and convert timestamps to ISO strings.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/session.test.ts tests/unit/repo/users.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repo/users.ts src/lib/session.ts tests/helpers/api.ts tests/unit/session.test.ts tests/unit/repo && git commit -m "feat: users repository, cookie sessions, API test helpers"
```

---

### Task 7: Content loader, seed content, database seed

**Files:**
- Create: `content/missions.json`, `content/rewards.json`, `content/sample-challenges.json`, `src/lib/content.ts`, `src/lib/repo/seed.ts`
- Modify: `src/lib/db/index.ts` (run the seed after migrations for PGlite, including `createTestDb`)
- Test: `tests/unit/content.test.ts`, `tests/unit/repo/seed.test.ts`

**Interfaces:**
- Consumes: `MissionSchema`, `RewardSchema`, `SYSTEM_USER_ID`, `SHARE_CODE_ALPHABET` (task 2); `Db` (task 5).
- Produces:

```ts
// src/lib/content.ts  (JSON imported statically and validated once at module load; invalid content throws)
export type SampleChallenge = { code: string; korean: string; meaningEn: string; situationEn: string };
export function getMissions(): Mission[];                    // file order
export function getMission(id: string): Mission | null;
export function getRewards(): Reward[];
export function getSampleChallenges(): SampleChallenge[];
export function todaysMissionIds(dateKst: string): string[]; // 'YYYY-MM-DD' in; three ids out, level 1 first (spec 9.4)

// src/lib/repo/seed.ts
export function ensureSeed(db: Db): Promise<void>;           // idempotent: system user, then sample challenges keyed by code
```

- [ ] **Step 1: Write the content files**

`content/missions.json` holds exactly these six for now (the content agent expands the list later):

```json
[
  { "id": "cafe-iced-americano", "mode": "repeat", "korean": "아이스 아메리카노 한 잔 주세요.", "keyword": null, "romanization": "aiseu amerikano han jan juseyo", "meaningEn": "One iced americano, please.", "situationEn": "At a café counter, when the barista asks for your order.", "promptEn": "Say this to the barista.", "level": 1, "basePoints": 10, "referenceAudio": null, "tags": ["cafe"] },
  { "id": "greet-nice-to-meet", "mode": "repeat", "korean": "만나서 반갑습니다.", "keyword": null, "romanization": "mannaseo bangapseumnida", "meaningEn": "Nice to meet you.", "situationEn": "When you meet a classmate or a new teammate for the first time.", "promptEn": "Say this to someone you are meeting for the first time.", "level": 1, "basePoints": 10, "referenceAudio": null, "tags": ["friends", "campus"] },
  { "id": "store-no-receipt", "mode": "repeat", "korean": "영수증은 버려 주세요.", "keyword": null, "romanization": "yeongsujeungeun beoryeo juseyo", "meaningEn": "Please throw the receipt away.", "situationEn": "At a convenience store checkout, when the cashier asks if you want the receipt.", "promptEn": "Say this to the cashier.", "level": 2, "basePoints": 20, "referenceAudio": null, "tags": ["shopping"] },
  { "id": "transit-this-stop", "mode": "repeat", "korean": "이번 역에서 내려요.", "keyword": null, "romanization": "ibeon yeogeseo naeryeoyo", "meaningEn": "I'm getting off at this station.", "situationEn": "On a crowded subway, when you need people to let you through.", "promptEn": "Say this to the person standing by the door.", "level": 2, "basePoints": 20, "referenceAudio": null, "tags": ["transit"] },
  { "id": "slang-daebak", "mode": "use", "korean": "대박, 이 노래 진짜 좋다!", "keyword": "대박", "romanization": "daebak, i norae jinjja jota", "meaningEn": "\"Wow, amazing\": said when something is surprisingly great.", "situationEn": "With friends, reacting to a song, food, or news that amazed you.", "promptEn": "Make your own sentence with 대박 about something that amazed you today.", "level": 2, "basePoints": 20, "referenceAudio": null, "tags": ["slang", "friends"] },
  { "id": "campus-group-roles", "mode": "repeat", "korean": "조별 과제 역할을 어떻게 나눌까요?", "keyword": null, "romanization": "jobyeol gwaje yeokhareul eotteoke nanulkkayo", "meaningEn": "How should we divide the roles for the group project?", "situationEn": "In the first meeting of a group project.", "promptEn": "Say this to your teammates.", "level": 3, "basePoints": 30, "referenceAudio": null, "tags": ["campus"] }
]
```

`content/rewards.json`:

```json
[
  { "id": "kpop-album", "category": "kpop", "title": "K-pop album voucher", "description": "Put it toward any album you like.", "cost": 3000 },
  { "id": "kpop-photocard", "category": "kpop", "title": "Photocard set voucher", "description": "One photocard set of your choice.", "cost": 1200 },
  { "id": "grocery-10000", "category": "grocery", "title": "Grocery 10,000 won coupon", "description": "For your weekly shop.", "cost": 1000 },
  { "id": "fashion-10", "category": "fashion", "title": "Fashion 10% off coupon", "description": "For clothes and accessories.", "cost": 800 },
  { "id": "cvs-5000", "category": "grocery", "title": "Convenience store 5,000 won coupon", "description": "Snacks, drinks, late-night ramyeon.", "cost": 500 },
  { "id": "cafe-drink", "category": "cafe", "title": "Café drink coupon", "description": "One drink. Order it in Korean.", "cost": 400 }
]
```

`content/sample-challenges.json`:

```json
[
  { "code": "SMPL22", "korean": "오늘 점메추 좀 해 줘.", "meaningEn": "점메추 is short for 점심 메뉴 추천: \"recommend a lunch menu\". You are asking a friend to pick lunch.", "situationEn": "Asking a friend right before lunch." },
  { "code": "SMPL23", "korean": "나 요즘 갓생 살고 있어.", "meaningEn": "갓생 means living a diligent, productive life.", "situationEn": "Telling a friend about your new routine: gym, study, early mornings." }
]
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/content.test.ts`:

```ts
import { expect, it } from 'vitest';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { getMission, getMissions, getRewards, getSampleChallenges, todaysMissionIds } from '@/lib/content';

it('loads valid content', () => {
  expect(getMissions().length).toBeGreaterThanOrEqual(6);
  expect(new Set(getMissions().map((m) => m.id)).size).toBe(getMissions().length);
  expect(getMission('cafe-iced-americano')).toMatchObject({ mode: 'repeat', basePoints: 10, keyword: null });
  expect(getMission('slang-daebak')).toMatchObject({ mode: 'use', keyword: '대박' });
  expect(getMission('nope')).toBeNull();
  expect(getRewards().map((r) => r.cost)).toEqual([3000, 1200, 1000, 800, 500, 400]);
  for (const s of getSampleChallenges()) {
    expect(s.code).toHaveLength(6);
    expect([...s.code].every((ch) => SHARE_CODE_ALPHABET.includes(ch))).toBe(true);
  }
});
it("picks today's missions deterministically, one per level", () => {
  const ids = todaysMissionIds('2026-11-15');
  expect(ids).toHaveLength(3);
  expect(ids.map((id) => getMission(id)!.level)).toEqual([1, 2, 3]);
  expect(todaysMissionIds('2026-11-15')).toEqual(ids);
  const level1 = getMissions().filter((m) => m.level === 1);
  // 2026-11-15 is day 319 of the year
  expect(ids[0]).toBe(level1[319 % level1.length].id);
  expect(todaysMissionIds('2026-01-01')[0]).toBe(level1[1 % level1.length].id);
});
```

`tests/unit/repo/seed.test.ts`:

```ts
import { expect, it } from 'vitest';
import { SYSTEM_USER_ID } from '@/lib/contracts';
import { getSampleChallenges } from '@/lib/content';
import { getDb } from '@/lib/db';
import { ensureSeed } from '@/lib/repo/seed';
import { getUser } from '@/lib/repo/users';
import { useTestDb } from '../../helpers/api';

useTestDb();

it('seeds the system user and sample challenges once', async () => {
  const db = await getDb();                       // createTestDb already seeded
  expect(await getUser(SYSTEM_USER_ID)).toMatchObject({ nickname: 'HanLog 팀', role: 'korean' });
  const count = async () => (await db.query<{ n: number }>('select count(*)::int as n from hanlog.challenges where is_sample'))[0].n;
  expect(await count()).toBe(getSampleChallenges().length);
  await ensureSeed(db);
  expect(await count()).toBe(getSampleChallenges().length);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/unit/content.test.ts tests/unit/repo/seed.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `content.ts`, `seed.ts`, and call `ensureSeed` from the PGlite path in `db/index.ts`**

The system user row uses `ip_hash = 'system'`. Day of year counts 1 January as day 1.

- [ ] **Step 5: Run to verify they pass, then the whole suite**

Run: `npm run test`
Expected: PASS, including the task 6 tests (they must tolerate the seeded system user).

- [ ] **Step 6: Commit**

```bash
git add content src/lib/content.ts src/lib/repo/seed.ts src/lib/db/index.ts tests/unit/content.test.ts tests/unit/repo/seed.test.ts && git commit -m "feat: content loader, seed content, database seed"
```

---

### Task 8: Scoring core

**Files:**
- Create: `src/lib/scoring/types.ts`, `src/lib/scoring/jamo.ts`, `src/lib/scoring/compose.ts`, `src/lib/scoring/mock.ts`, `src/lib/scoring/openai.ts` (stub), `src/lib/scoring/index.ts`
- Test: `tests/unit/scoring/jamo.test.ts`, `tests/unit/scoring/compose.test.ts`, `tests/unit/scoring/index.test.ts`

**Interfaces:**
- Consumes: `Mission`, `Score`, `ScoreIssue`, `LIMITS` (task 2); `wavRms` (task 4); `getConfig` (task 3).
- Produces:

```ts
// types.ts
export type RawScore = { speechDetected: boolean; heard: string; pronunciation: number; accuracy: number; usage: number; issues: ScoreIssue[]; praise: string; nextTip: string };
export const RawScoreSchema: /* zod schema for RawScore; numbers may be any finite number */;
export interface ScoringProvider { readonly name: 'mock' | 'openai'; score(input: { wav: Uint8Array; mission: Mission }): Promise<RawScore>; }
export class NoSpeechError extends Error {}
export class ScoringFailedError extends Error {}

// jamo.ts
export function normalizeHangul(s: string): string;
export function jamoSimilarity(a: string, b: string): number;   // spec 5.4

// compose.ts
export function composeScore(raw: RawScore, mission: Mission, scoredBy: 'ai' | 'mock'): Score; // spec 5.4, throws NoSpeechError

// mock.ts
export const mockProvider: ScoringProvider;                      // spec 5.5

// openai.ts  (stub now; plan 02 replaces the body)
export function createOpenAiProvider(opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number }): ScoringProvider;

// index.ts
export function getScoringProvider(): ScoringProvider;           // from getConfig().scoringProvider
export function scoreAttempt(wav: Uint8Array, mission: Mission): Promise<Score>; // provider.score then composeScore; scoredBy 'mock' for the mock, 'ai' otherwise
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/scoring/jamo.test.ts`:

```ts
import { expect, it } from 'vitest';
import { jamoSimilarity, normalizeHangul } from '@/lib/scoring/jamo';

const target = '아이스 아메리카노 한 잔 주세요';
it('normalizes', () => { expect(normalizeHangul('대박, 이 노래 ABC 12!')).toBe('대박이노래'); });
it('is 1 for the same syllables regardless of spacing and punctuation', () => {
  expect(jamoSimilarity('안녕하세요.', ' 안녕 하세요!')).toBe(1);
});
it('stays high for near misses', () => {
  // the target is 28 jamo tokens
  expect(jamoSimilarity('아이스 아메리카노 한 잔 주세여', target)).toBeCloseTo(27 / 28, 5); // one vowel substituted
  expect(jamoSimilarity('아이스 아메리카노 한 자 주세요', target)).toBeCloseTo(27 / 28, 5); // one final consonant dropped
  expect(jamoSimilarity('아이스 아메리카노 주세요', target)).toBeCloseTo(22 / 28, 5);       // two words missing
});
it('falls below the gate for half or unrelated sentences', () => {
  expect(jamoSimilarity('아이스 아메리카노', target)).toBeCloseTo(16 / 28, 5);
  expect(jamoSimilarity('감사합니다', target)).toBeLessThan(0.45);
  expect(jamoSimilarity('만나서 반갑습니다', '감사합니다')).toBeCloseTo(9 / 20, 5);
});
it('is 0 when either side has no Hangul', () => {
  expect(jamoSimilarity('', '안녕')).toBe(0);
  expect(jamoSimilarity('hello', '안녕')).toBe(0);
  expect(jamoSimilarity('', '')).toBe(0);
});
it('does not confuse an initial with a final of the same letter', () => {
  expect(jamoSimilarity('가', '악')).toBeLessThan(1);
});
```

`tests/unit/scoring/compose.test.ts`:

```ts
import { expect, it } from 'vitest';
import { getMission } from '@/lib/content';
import { composeScore } from '@/lib/scoring/compose';
import { NoSpeechError, type RawScore } from '@/lib/scoring/types';

const repeat = getMission('cafe-iced-americano')!;
const use = getMission('slang-daebak')!;
const raw = (o: Partial<RawScore> = {}): RawScore =>
  ({ speechDetected: true, heard: repeat.korean, pronunciation: 84, accuracy: 96, usage: 88, issues: [], praise: 'p', nextTip: 't', ...o });

it('weights by mode', () => {
  expect(composeScore(raw(), repeat, 'mock')).toMatchObject({ overall: 88, pronunciation: 84, accuracy: 96, usage: 88, scoredBy: 'mock' });
  expect(composeScore(raw({ heard: use.korean }), use, 'ai')).toMatchObject({ overall: 89, scoredBy: 'ai' });
});
it('throws when nothing was said', () => {
  expect(() => composeScore(raw({ speechDetected: false }), repeat, 'ai')).toThrow(NoSpeechError);
  expect(() => composeScore(raw({ heard: '   ' }), repeat, 'ai')).toThrow(NoSpeechError);
});
it('never pays for a different sentence, whatever the model claims', () => {
  const s = composeScore(raw({ heard: '감사합니다', pronunciation: 100, accuracy: 100, usage: 100 }), repeat, 'ai');
  expect(s.accuracy).toBeLessThanOrEqual(55);
  expect(s.overall).toBeLessThanOrEqual(49);
});
it('keeps near misses above the gate', () => {
  const s = composeScore(raw({ heard: '아이스 아메리카노 한 잔 주세여' }), repeat, 'ai');
  expect(s.accuracy).toBe(96);
  expect(s.overall).toBe(88);
});
it('caps accuracy by similarity plus ten', () => {
  const s = composeScore(raw({ heard: '아이스 아메리카노 주세요', accuracy: 100 }), repeat, 'ai'); // similarity 0.79
  expect(s.accuracy).toBe(89);
});
it('requires the keyword in use mode', () => {
  const s = composeScore(raw({ heard: '이 노래 진짜 좋다', pronunciation: 100, accuracy: 100, usage: 100 }), use, 'ai');
  expect(s.accuracy).toBe(40);
  expect(s.overall).toBeLessThanOrEqual(49);
});
it('clamps, rounds, and trims', () => {
  const long = 'x'.repeat(500);
  const s = composeScore(raw({
    pronunciation: 140, accuracy: -5, usage: 83.6,
    issues: Array.from({ length: 5 }, () => ({ segment: ' 잔 ', problem: long, tip: long })),
    praise: long, nextTip: long,
  }), use, 'ai');
  expect([s.pronunciation, s.accuracy, s.usage]).toEqual([100, 0, 84]);
  expect(s.issues).toHaveLength(3);
  expect(s.issues[0].segment).toBe('잔');
  expect(s.issues[0].problem).toHaveLength(200);
  expect(s.praise).toHaveLength(240);
  expect(s.nextTip).toHaveLength(240);
});
```

`tests/unit/scoring/index.test.ts`:

```ts
import { expect, it } from 'vitest';
import { getMission } from '@/lib/content';
import { getScoringProvider, scoreAttempt } from '@/lib/scoring';
import { NoSpeechError } from '@/lib/scoring/types';
import { noiseWav, silentWav, toneWav } from '../../helpers/audio';

const mission = getMission('cafe-iced-americano')!;
it('uses the mock provider with no configuration', () => { expect(getScoringProvider().name).toBe('mock'); });
it('scores audible audio deterministically', async () => {
  const a = await scoreAttempt(toneWav(1500), mission);
  expect(a).toMatchObject({ overall: 88, heard: mission.korean, scoredBy: 'mock' });
  expect(a.issues).toHaveLength(1);
  expect(await scoreAttempt(noiseWav(1500), mission)).toEqual(a);
});
it('reports silence as no speech', async () => {
  await expect(scoreAttempt(silentWav(1500), mission)).rejects.toBeInstanceOf(NoSpeechError);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/scoring`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the scoring modules**

`jamoSimilarity` tokens: for each Hangul syllable with index `i = codePoint - 0xAC00`, emit `c{floor(i / 588)}`, `v{floor((i % 588) / 28)}`, and `f{i % 28}` only when `i % 28 > 0`. Similarity is `1 - levenshtein(tokensA, tokensB) / max(lenA, lenB)`.

Mock provider values (spec 5.5): pronunciation 84, accuracy 96, usage 88; issue `{ segment: <first Hangul syllable of mission.korean>, problem: 'Demo feedback: the final consonant was a little soft.', tip: 'Hold the final consonant briefly before the next syllable.' }`; praise `'Clear and confident. Nice work.'`; nextTip `'Try it once more at natural speed.'`.

The `openai.ts` stub returns a provider named `'openai'` whose `score` rejects with `new ScoringFailedError('OpenAI provider is not implemented yet')`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/scoring`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring tests/unit/scoring && git commit -m "feat: scoring core with jamo similarity, composition rules, and mock provider"
```

---

### Task 9: Typed API client

**Files:**
- Create: `src/lib/api-client.ts`, `tests/fixtures/api/samples.ts`
- Test: `tests/unit/api-client.test.ts`

**Interfaces:**
- Consumes: every response type and schema from task 2.
- Produces:

```ts
export class ApiClientError extends Error { readonly code: ApiErrorCode; readonly status: number; constructor(code: ApiErrorCode, status: number, message: string); }
export const api: {
  getSession(): Promise<User | null>;
  createSession(input: { nickname: string; role: Role }): Promise<User>;       // sends consent: true
  updateSession(patch: { nickname?: string; role?: Role }): Promise<User>;
  deleteSession(): Promise<void>;
  listMissions(): Promise<{ missions: MissionWithProgress[]; today: string[] }>;
  submitAttempt(missionId: string, wav: Uint8Array): Promise<AttemptResult>;   // multipart field "audio", file type audio/wav
  getPoints(): Promise<PointsSummary>;
  listRewards(): Promise<Reward[]>;
  listChallenges(scope: ChallengeScope): Promise<Challenge[]>;
  createChallenge(input: { korean: string; meaningEn: string; situationEn: string; media?: { blob: Blob; durationMs: number } }): Promise<Challenge>;
  getChallenge(idOrCode: string): Promise<ChallengeDetail>;
  submitResponse(challengeId: string, input: { blob: Blob; kind: MediaKind; durationMs: number }): Promise<ChallengeResponse>;
  rateResponse(responseId: string, input: { pronunciation: number; naturalness: number; comment: string }): Promise<ChallengeResponse>;
  giveFeedback(responseId: string, input: { helpfulness: number; comment: string }): Promise<ChallengeResponse>;
  reportResponse(responseId: string): Promise<void>;
  mediaUrl: { response(responseId: string): string; reference(challengeId: string): string };
  fetchMediaBlobUrl(url: string): Promise<string>;   // fetch, read as Blob, return URL.createObjectURL(blob); caller revokes
};

// tests/fixtures/api/samples.ts — one valid example of each response type, validated against its schema, for UI tests
export const samples: { user: User; koreanUser: User; missions: MissionWithProgress[]; attemptResult: AttemptResult; points: PointsSummary; rewards: Reward[]; challenge: Challenge; challengeDetailForLearner: ChallengeDetail; challengeDetailForAuthor: ChallengeDetail; response: ChallengeResponse; ratedResponse: ChallengeResponse };
```

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { ApiClientError, api } from '@/lib/api-client';
import { AttemptResultSchema, ChallengeDetailSchema, UserSchema } from '@/lib/contracts';
import { samples } from '../fixtures/api/samples';
import { toneWav } from '../helpers/audio';

const respond = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
afterEach(() => vi.unstubAllGlobals());

it('fixtures match the contracts', () => {
  expect(UserSchema.safeParse(samples.user).success).toBe(true);
  expect(AttemptResultSchema.safeParse(samples.attemptResult).success).toBe(true);
  expect(ChallengeDetailSchema.safeParse(samples.challengeDetailForAuthor).success).toBe(true);
});
it('returns null when there is no session', async () => {
  vi.stubGlobal('fetch', respond(200, { user: null }));
  expect(await api.getSession()).toBeNull();
});
it('creates a session with consent and same-origin credentials', async () => {
  const fetchMock = respond(201, { user: samples.user });
  vi.stubGlobal('fetch', fetchMock);
  expect(await api.createSession({ nickname: 'Aisha', role: 'learner' })).toEqual(samples.user);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/session');
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('same-origin');
  expect(JSON.parse(init.body as string)).toEqual({ nickname: 'Aisha', role: 'learner', consent: true });
});
it('uploads a WAV as multipart field "audio"', async () => {
  const fetchMock = respond(200, samples.attemptResult);
  vi.stubGlobal('fetch', fetchMock);
  await api.submitAttempt('cafe-iced-americano', toneWav(600));
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('/api/missions/cafe-iced-americano/attempts');
  const file = (init.body as FormData).get('audio') as File;
  expect(file.type).toBe('audio/wav');
  expect(file.size).toBe(44 + 600 * 32);
});
it('turns error bodies into ApiClientError', async () => {
  vi.stubGlobal('fetch', respond(429, { error: { code: 'daily_limit', message: 'x' } }));
  await expect(api.getPoints()).rejects.toMatchObject({ code: 'daily_limit', status: 429 });
  expect(await api.getPoints().catch((e) => e)).toBeInstanceOf(ApiClientError);
});
it('maps non-JSON failures and network failures to internal', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })));
  await expect(api.listRewards()).rejects.toMatchObject({ code: 'internal', status: 502 });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
  await expect(api.listRewards()).rejects.toMatchObject({ code: 'internal', status: 0 });
});
it('builds media URLs and encodes path segments', () => {
  expect(api.mediaUrl.response('abc')).toBe('/api/responses/abc/media');
  expect(api.mediaUrl.reference('abc')).toBe('/api/challenges/abc/reference');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/api-client.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the client and the fixtures**

Fixture contents other plans rely on: `samples.user` is a learner and `samples.koreanUser` a Korean speaker; `samples.missions` is the six seed missions (so it includes `cafe-iced-americano` and `slang-daebak`) with `bestOverall: null` and `pointsEarned: 0`; `samples.rewards` is the six catalog rewards; `samples.attemptResult` is for `cafe-iced-americano` with overall 88, `pointsAwarded: 10`, `scoredBy: 'mock'`; `samples.challenge` is authored by `samples.koreanUser`; `samples.response` is a pending audio answer from `samples.user` with `mediaAvailable: true`; `samples.ratedResponse` is the same answer rated (pronunciation 4, naturalness 5, comment `좋아요!`) with `feedback: null`; `challengeDetailForLearner` has `viewerRole: 'responder'` and `myResponse: samples.response`; `challengeDetailForAuthor` has `viewerRole: 'author'` and `responses: [samples.response]`.

Paths and bodies follow spec section 9.3. `submitResponse` sends multipart fields `media`, `kind`, `durationMs`; `createChallenge` sends `korean`, `meaningEn`, `situationEn` and, when given, `media` and `durationMs`. Every call uses `credentials: 'same-origin'`. Do not set a `content-type` header on multipart requests.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/api-client.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-client.ts tests/fixtures/api tests/unit/api-client.test.ts && git commit -m "feat: typed API client and response fixtures"
```

---

### Task 10: Design tokens, root layout, placeholder pages, release tag

**Files:**
- Create: `docs/design/open-window/{DESIGN.md,tokens.json,reference.html}` (copied from `../design/open-window/`), `src/app/app/page.tsx`, `docs/handoffs/foundation.md`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/ui/tokens.test.tsx`

**Interfaces:**
- Produces: Tailwind theme tokens usable as utilities: colors `canvas`, `surface`, `ink`, `text-secondary`, `action`, `action-hover`, `action-soft`, `clay`, `apricot`, `line`, `control-edge`, `error-ink`, `error-surface`; radii `field`, `button`, `media`, `sheet`, `badge`; font families `title` and `body`. Every value comes from `docs/design/open-window/tokens.json`, never typed from memory: that file has already changed once (it is at version `0.3-warm-linen`).

- [ ] **Step 1: Copy the design direction into the repository**

```bash
mkdir -p docs/design/open-window && cp ../design/open-window/DESIGN.md ../design/open-window/tokens.json ../design/open-window/reference.html docs/design/open-window/
```

Expected: three files. Worktrees of other agents do not have `../design`, so this copy is what they read.

- [ ] **Step 2: Write the failing test**

```tsx
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8').toLowerCase();
const tokens = JSON.parse(readFileSync('docs/design/open-window/tokens.json', 'utf8'));
const colorNames: Record<string, string> = {
  canvas: 'canvas', surface: 'surface', ink: 'ink', textSecondary: 'text-secondary', action: 'action', actionHover: 'action-hover',
  actionSoft: 'action-soft', clayDecorative: 'clay', apricot: 'apricot', dividerDecorative: 'line', controlBorder: 'control-edge',
  errorInk: 'error-ink', errorSurface: 'error-surface',
};

it('declares every design color exactly as the token file has it', () => {
  for (const [key, name] of Object.entries(colorNames)) {
    expect(tokens.colors[key], `token ${key} missing from tokens.json`).toBeTruthy();
    expect(css).toMatch(new RegExp(`--color-${name}:\\s*${tokens.colors[key].toLowerCase()}`));
  }
});
it('declares the radii, the font stacks, and reduced motion', () => {
  for (const [name, px] of Object.entries(tokens.radius)) expect(css).toMatch(new RegExp(`--radius-${name}:\\s*${px}px`));
  expect(css).toContain('georgia');
  expect(css).toContain('prefers-reduced-motion');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/ui/tokens.test.tsx`
Expected: FAIL, tokens missing.

- [ ] **Step 4: Implement**

- `globals.css`: Tailwind 4 `@theme` block with the tokens; `body` uses canvas background, ink text, the body font stack; a global `:focus-visible` ring of 3px `action` with 3px offset; a `prefers-reduced-motion` block that removes transitions and animations. Remove the scaffold's default styles and dark mode.
- `layout.tsx`: `<html lang="en">`, metadata title `HanLog · Speak Korean out in the world`, description from spec section 4.1 hero, viewport width `device-width`. No web font imports.
- `src/app/page.tsx` and `src/app/app/page.tsx`: a single heading each ("HanLog" and "HanLog app") so the build has both routes. Plans 04 and 06 replace them.

- [ ] **Step 5: Verify everything**

Run: `npm run check && npm run build`
Expected: all suites pass; build lists routes `/` and `/app`.

Run: `npm run dev`, open `http://localhost:3000/`, then stop the server.
Expected: the heading renders on the canvas color from the token file with no console errors.

- [ ] **Step 6: Write `docs/handoffs/foundation.md`, commit, tag**

The handoff lists every exported name from tasks 2 to 9 with its file, the test count, and any deviation from this plan.

```bash
git add -A && git commit -m "feat: design tokens, root layout, placeholder routes" && git tag foundation-done
```
