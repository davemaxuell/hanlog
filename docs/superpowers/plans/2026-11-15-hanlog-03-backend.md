# HanLog Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every HTTP route in spec section 9.3, with server-side points, spending caps, text moderation, media storage, expiry, and account deletion.

**Architecture:** Thin Next.js route handlers in `src/app/api` that validate, authorize, and delegate to repositories in `src/lib/repo` (SQL through the `Db` interface) and to small services (`limits`, `moderation`, `media`, `points/rules`). Handlers are wrapped in `route()` from the foundation and are tested by calling them directly with a `Request`, against in-memory PGlite, an in-memory media store, and the mock scorer.

**Tech Stack:** Next.js 16 route handlers (Node.js runtime), zod, PGlite and pg, Supabase Storage client (server only), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, sections 6, 7, 9, 10, 11, 12. Orchestration: `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`.

**Two-agent split (optional):** tasks 1 to 7 are the solo loop, tasks 8 to 14 the peer loop. They touch different files and can run in parallel after task 4. Task 15 is last.

## Global Constraints

- Paths, bodies, status codes, error codes, and check order are exactly as spec section 9.3. Errors are always `{ error: { code, message } }`.
- Every handler is exported as `route(async (req, ctx) => ...)`. Dynamic segments arrive as `ctx.params`, a promise.
- The browser never supplies a score, a point value, a user id, or a role. Identity comes only from `requireUser(req)`.
- Points and caps are written inside transactions that take the advisory locks named in spec section 10.
- "Today" means the Korea-time day: use `kstDayStartIso()`.
- Never the Edge runtime. The attempts route exports `maxDuration = 60`.
- Edit only: `src/app/api/**`, `src/lib/points/**`, `src/lib/limits.ts`, `src/lib/moderation.ts`, `src/lib/media/**`, `src/lib/repo/{attempts,points,challenges,responses}.ts`, `scripts/migrate.ts`, `vercel.ts`, `tests/api/**`, `tests/unit/{points,limits,moderation,media}/**`, `docs/handoffs/backend.md`.
- Test setup for every API test file: `useTestDb()` from `tests/helpers/api`, plus `useMemoryMedia()` from `tests/api/_helpers` where media is involved.

## Review Focus

1. Two attempts on the same mission arriving at once must not both be paid. Pinned in task 3 and, with real concurrency, task 15.
2. Clearing the cookie to get a fresh daily allowance must still hit the address cap and the global cap. Pinned in task 2.
3. A user who switched role must not answer or rate their own content. Pinned in tasks 10 and 11.
4. A file whose declared type, declared kind, and magic bytes disagree must be rejected before it is stored. Pinned in task 8.
5. Expired, reported, or deleted media must answer 404, never 500 and never the bytes. Pinned in tasks 11, 12, and 14.

---

### Task 1: Points rules

**Files:**
- Create: `src/lib/points/rules.ts`
- Test: `tests/unit/points/rules.test.ts`

**Interfaces:**
- Produces:

```ts
export function missionAward(basePoints: number, overall: number): number;
export function peerResponseAward(pronunciation: number, naturalness: number): number;
export const PEER_RATING_AWARD = 10;
export const PEER_FEEDBACK_GIVER_AWARD = 5;
export function peerFeedbackAuthorAward(helpfulness: number): number;
export const POINT_LABELS: { mission(korean: string): string; peerResponse: string; peerRating: string; feedbackGiven: string; feedbackReceived: string };
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { PEER_FEEDBACK_GIVER_AWARD, PEER_RATING_AWARD, POINT_LABELS, missionAward, peerFeedbackAuthorAward, peerResponseAward } from '@/lib/points/rules';

it('pays missions by tier', () => {
  expect([100, 85].map((o) => missionAward(10, o))).toEqual([10, 10]);
  expect([84, 70].map((o) => missionAward(10, o))).toEqual([6, 6]);
  expect([69, 50].map((o) => missionAward(10, o))).toEqual([3, 3]);
  expect([49, 0].map((o) => missionAward(10, o))).toEqual([0, 0]);
  expect(missionAward(20, 84)).toBe(12);
  expect(missionAward(20, 50)).toBe(6);
  expect(missionAward(30, 69)).toBe(9);
  expect(missionAward(30, 85)).toBe(30);
});
it('pays the peer loop', () => {
  expect(peerResponseAward(1, 1)).toBe(6);
  expect(peerResponseAward(4, 5)).toBe(27);
  expect(peerResponseAward(5, 5)).toBe(30);
  expect(PEER_RATING_AWARD).toBe(10);
  expect(PEER_FEEDBACK_GIVER_AWARD).toBe(5);
  expect([1, 5].map(peerFeedbackAuthorAward)).toEqual([2, 10]);
});
it('labels ledger entries as the spec says', () => {
  expect(POINT_LABELS.mission('만나서 반갑습니다.')).toBe('Mission: 만나서 반갑습니다.');
  expect(POINT_LABELS).toMatchObject({ peerResponse: 'Your answer was rated', peerRating: 'You rated an answer', feedbackGiven: 'Thanks for your feedback', feedbackReceived: 'Feedback on your rating' });
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/unit/points`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `rules.ts`** from the table in spec section 6.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Commit.** `git add src/lib/points tests/unit/points && git commit -m "feat: points rules"`

---

### Task 2: Scoring-call caps

**Files:**
- Create: `src/lib/limits.ts`
- Test: `tests/unit/limits/limits.test.ts`

**Interfaces:**
- Consumes: `getDb`, `getConfig`, `ApiError`, `kstDayStartIso`.
- Produces:

```ts
export type Reservation = { id: string; leftToday: number };
export function reserveScoringCall(input: { userId: string; ipHash: string; now?: Date }): Promise<Reservation>; // ApiError('daily_limit') or ApiError('budget_exhausted')
export function finishScoringCall(id: string, outcome: 'scored' | 'no_speech' | 'failed'): Promise<void>;
```

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { finishScoringCall, reserveScoringCall } from '@/lib/limits';
import { useTestDb } from '../../helpers/api';

useTestDb();
afterEach(() => vi.unstubAllEnvs());
const u = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

it('counts down the user allowance and then refuses', async () => {
  vi.stubEnv('USER_DAILY_ATTEMPTS', '2');
  expect((await reserveScoringCall({ userId: u(10), ipHash: 'a' })).leftToday).toBe(1);
  expect((await reserveScoringCall({ userId: u(10), ipHash: 'a' })).leftToday).toBe(0);
  await expect(reserveScoringCall({ userId: u(10), ipHash: 'a' })).rejects.toMatchObject({ code: 'daily_limit' });
  expect((await reserveScoringCall({ userId: u(11), ipHash: 'b' })).leftToday).toBe(1);
});
it('caps an address across users, so a cleared cookie does not reset it', async () => {
  vi.stubEnv('IP_DAILY_ATTEMPTS', '2');
  await reserveScoringCall({ userId: u(10), ipHash: 'same' });
  await reserveScoringCall({ userId: u(11), ipHash: 'same' });
  await expect(reserveScoringCall({ userId: u(12), ipHash: 'same' })).rejects.toMatchObject({ code: 'daily_limit' });
});
it('does not apply the address cap to an unknown address', async () => {
  vi.stubEnv('IP_DAILY_ATTEMPTS', '1');
  await reserveScoringCall({ userId: u(10), ipHash: 'unknown' });
  await expect(reserveScoringCall({ userId: u(11), ipHash: 'unknown' })).resolves.toBeTruthy();
});
it('stops everyone at the global cap', async () => {
  vi.stubEnv('GLOBAL_DAILY_ATTEMPTS', '2');
  await reserveScoringCall({ userId: u(10), ipHash: 'a' });
  await reserveScoringCall({ userId: u(11), ipHash: 'b' });
  await expect(reserveScoringCall({ userId: u(12), ipHash: 'c' })).rejects.toMatchObject({ code: 'budget_exhausted' });
});
it('resets at Korea-time midnight and counts failed calls', async () => {
  vi.stubEnv('USER_DAILY_ATTEMPTS', '1');
  const r = await reserveScoringCall({ userId: u(10), ipHash: 'a', now: new Date('2026-11-15T14:00:00Z') }); // 23:00 on the 15th in Korea
  await finishScoringCall(r.id, 'failed');
  await expect(reserveScoringCall({ userId: u(10), ipHash: 'a', now: new Date('2026-11-15T14:30:00Z') })).rejects.toMatchObject({ code: 'daily_limit' });
  await expect(reserveScoringCall({ userId: u(10), ipHash: 'a', now: new Date('2026-11-15T15:30:00Z') })).resolves.toBeTruthy(); // 00:30 on the 16th
  const rows = await (await getDb()).query<{ outcome: string }>('select outcome from hanlog.scoring_calls order by id');
  expect(rows.map((x) => x.outcome)).toEqual(['failed', 'pending']);
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/unit/limits`. Expected: FAIL.
- [ ] **Step 3: Implement.** One transaction: `select pg_advisory_xact_lock(hashtext('scoring_calls'))`, count rows since `kstDayStartIso(now)` for the user, the address (skipped when `ipHash === 'unknown'`), and everyone; check the global cap first, then address, then user; insert with `created_at = now`. `leftToday` is the user limit minus the user's count including this call.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/lib/limits.ts tests/unit/limits && git commit -m "feat: daily scoring caps per user, address, and globally"`

---

### Task 3: Attempts and points repositories

**Files:**
- Create: `src/lib/repo/attempts.ts`, `src/lib/repo/points.ts`
- Test: `tests/api/repo-attempts.test.ts`

**Interfaces:**
- Consumes: `missionAward`, `POINT_LABELS` (task 1); `Db`, `getDb`.
- Produces:

```ts
// points.ts
export function addPointEvent(db: Db, e: { userId: string; delta: number; reason: PointReason; refId: string; label: string }): Promise<void>; // does nothing when delta is 0
export function getBalance(db: Db, userId: string): Promise<number>;
export function getPoints(userId: string): Promise<PointsSummary>;       // newest first, at most 50 events

// attempts.ts
export function recordAttempt(input: { userId: string; mission: Mission; score: Score }): Promise<{ attempt: Attempt; balance: number; bestOverall: number }>;
export function missionProgress(userId: string): Promise<Record<string, { bestOverall: number; pointsEarned: number }>>;
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import type { Score } from '@/lib/contracts';
import { getMission } from '@/lib/content';
import { missionProgress, recordAttempt } from '@/lib/repo/attempts';
import { getPoints } from '@/lib/repo/points';
import { createTestUser, useTestDb } from '../helpers/api';

useTestDb();
const score = (overall: number): Score => ({ overall, pronunciation: overall, accuracy: overall, usage: overall, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' });
const L1 = getMission('cafe-iced-americano')!, L2 = getMission('store-no-receipt')!, L3 = getMission('campus-group-roles')!;

it('pays once per mission, up to its base points', async () => {
  const { user } = await createTestUser();
  expect(await recordAttempt({ userId: user.id, mission: L1, score: score(88) })).toMatchObject({ attempt: { pointsAwarded: 10, missionId: L1.id }, balance: 10, bestOverall: 88 });
  expect(await recordAttempt({ userId: user.id, mission: L1, score: score(95) })).toMatchObject({ attempt: { pointsAwarded: 0 }, balance: 10, bestOverall: 95 });
});
it('pays only the improvement', async () => {
  const { user } = await createTestUser();
  expect((await recordAttempt({ userId: user.id, mission: L2, score: score(72) })).attempt.pointsAwarded).toBe(12);
  expect((await recordAttempt({ userId: user.id, mission: L2, score: score(90) })).attempt.pointsAwarded).toBe(8);
  expect(await recordAttempt({ userId: user.id, mission: L2, score: score(60) })).toMatchObject({ attempt: { pointsAwarded: 0 }, balance: 20, bestOverall: 90 });
  expect(await missionProgress(user.id)).toEqual({ [L2.id]: { bestOverall: 90, pointsEarned: 20 } });
});
it('does not double pay simultaneous attempts', async () => {
  const { user } = await createTestUser();
  const results = await Promise.all([1, 2, 3].map(() => recordAttempt({ userId: user.id, mission: L3, score: score(90) })));
  expect(results.reduce((sum, r) => sum + r.attempt.pointsAwarded, 0)).toBe(30);
  expect((await getPoints(user.id)).balance).toBe(30);
});
it('reports the ledger newest first with spec labels', async () => {
  const { user } = await createTestUser();
  await recordAttempt({ userId: user.id, mission: L1, score: score(88) });
  await recordAttempt({ userId: user.id, mission: L2, score: score(40) });   // no points, no event
  await recordAttempt({ userId: user.id, mission: L3, score: score(88) });
  const { balance, events } = await getPoints(user.id);
  expect(balance).toBe(40);
  expect(events.map((e) => [e.delta, e.reason, e.label])).toEqual([[30, 'mission', `Mission: ${L3.korean}`], [10, 'mission', `Mission: ${L1.korean}`]]);
  expect(await getPoints('3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11')).toEqual({ balance: 0, events: [] });
});
it('stores the score so it reads back identically', async () => {
  const { user } = await createTestUser();
  const s = { ...score(77), heard: '아이스', issues: [{ segment: '잔', problem: 'a', tip: 'b' }] };
  expect((await recordAttempt({ userId: user.id, mission: L1, score: s })).attempt.score).toEqual(s);
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/api/repo-attempts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `recordAttempt` runs in one transaction: lock `pg_advisory_xact_lock(hashtext(userId))`; `earned` is the sum of `points_awarded` for this user and mission; award is `max(0, missionAward(mission.basePoints, score.overall) - earned)`; insert the attempt; `addPointEvent` with `refId` the attempt id; return the new balance and the best overall for the mission.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/lib/repo/attempts.ts src/lib/repo/points.ts tests/api/repo-attempts.test.ts && git commit -m "feat: attempts and points repositories with atomic awards"`

---

### Task 4: Text moderation

**Files:**
- Create: `src/lib/moderation.ts`
- Test: `tests/unit/moderation/moderation.test.ts`

**Interfaces:**
- Produces: `export function assertTextAllowed(texts: string[], deps?: { fetchImpl?: typeof fetch }): Promise<void>;` throws `ApiError('content_rejected')` or `ApiError('service_unavailable')`.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { assertTextAllowed } from '@/lib/moderation';

afterEach(() => vi.unstubAllEnvs());
const reply = (flags: boolean[]) => vi.fn(async () => new Response(JSON.stringify({ results: flags.map((flagged) => ({ flagged })) }), { status: 200 }));

it('rejects links without calling anyone', async () => {
  const f = reply([false]);
  await expect(assertTextAllowed(['join www.spam.example'], { fetchImpl: f as unknown as typeof fetch })).rejects.toMatchObject({ code: 'content_rejected' });
  expect(f).not.toHaveBeenCalled();
});
it('passes clean text offline when no key is configured', async () => {
  const f = reply([true]);
  await expect(assertTextAllowed(['오늘 점메추 좀 해 줘.', ''], { fetchImpl: f as unknown as typeof fetch })).resolves.toBeUndefined();
  expect(f).not.toHaveBeenCalled();
});
it('asks the moderation endpoint when a key is configured', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  const f = reply([false, false]);
  await assertTextAllowed(['hello', '', '안녕'], { fetchImpl: f as unknown as typeof fetch });
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/moderations');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  expect(JSON.parse(init.body as string)).toEqual({ model: 'omni-moderation-latest', input: ['hello', '안녕'] });
});
it('rejects flagged text and fails closed when the service is down', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  await expect(assertTextAllowed(['a', 'b'], { fetchImpl: reply([false, true]) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'content_rejected' });
  await expect(assertTextAllowed(['a'], { fetchImpl: vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'service_unavailable' });
  await expect(assertTextAllowed(['a'], { fetchImpl: vi.fn(async () => { throw new TypeError('network'); }) as unknown as typeof fetch })).rejects.toMatchObject({ code: 'service_unavailable' });
});
it('makes no call when every text is empty', async () => {
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  const f = reply([]);
  await assertTextAllowed(['', '  '], { fetchImpl: f as unknown as typeof fetch });
  expect(f).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** Use `hasLink` from contracts; timeout 5000 ms.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/lib/moderation.ts tests/unit/moderation && git commit -m "feat: text moderation with link rule and OpenAI check"`

---

### Task 5: Session routes

**Files:**
- Create: `src/app/api/session/route.ts` (exports `GET`, `POST`, `PATCH`; `DELETE` arrives in task 13), `tests/api/_helpers.ts`
- Test: `tests/api/session.test.ts`

**Interfaces:**
- Consumes: `createUser`, `updateUser`, `countUsersSince`, session helpers, `assertTextAllowed`, `CreateSessionInputSchema`, `UpdateSessionInputSchema`.
- Produces in `tests/api/_helpers.ts`:

```ts
export function call(handler: (req: Request, ctx: never) => Promise<Response>, req: Request, params?: Record<string, string>): Promise<Response>; // passes { params: Promise.resolve(params ?? {}) }
export function cookieFrom(res: Response): string;                 // "hl_session=<token>" from Set-Cookie
```

Task 8 adds the media helpers to this file and tasks 11 and 12 add request helpers. If two agents split this plan, the peer-loop agent owns this file after task 5.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { GET, PATCH, POST } from '@/app/api/session/route';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, cookieFrom } from './_helpers';

useTestDb();
afterEach(() => vi.unstubAllEnvs());
const users = async () => (await (await getDb()).query<{ n: number }>(`select count(*)::int as n from hanlog.users where ip_hash <> 'system'`))[0].n;
const create = (json: unknown, opts = {}) => call(POST, makeRequest('POST', '/api/session', { json, ...opts }));

it('reports no user without a cookie', async () => {
  expect(await (await call(GET, makeRequest('GET', '/api/session'))).json()).toEqual({ user: null });
});
it('creates a user and a cookie that works', async () => {
  const res = await create({ nickname: '  아이샤 ', role: 'learner', consent: true });
  expect(res.status).toBe(201);
  const { user } = await res.json();
  expect(user).toMatchObject({ nickname: '아이샤', role: 'learner' });
  expect((await (await call(GET, makeRequest('GET', '/api/session', { cookie: cookieFrom(res) }))).json()).user.id).toBe(user.id);
});
it('returns the existing user instead of creating a second one', async () => {
  const { user, cookie } = await createTestUser();
  const res = await create({ nickname: 'Other', role: 'korean', consent: true }, { cookie });
  expect(res.status).toBe(200);
  expect((await res.json()).user.id).toBe(user.id);
  expect(await users()).toBe(1);
});
it('rejects bad input', async () => {
  expect((await create({ nickname: 'a', role: 'learner', consent: true })).status).toBe(400);
  expect((await create({ nickname: 'Aisha', role: 'learner', consent: false })).status).toBe(400);
  expect((await create('not an object')).status).toBe(400);
  const linky = await create({ nickname: 'www.spam.co', role: 'learner', consent: true });
  expect([linky.status, (await linky.json()).error.code]).toEqual([422, 'content_rejected']);
  expect(await users()).toBe(0);
});
it('refuses cross-origin writes', async () => {
  expect((await create({ nickname: 'Aisha', role: 'learner', consent: true }, { headers: { origin: 'https://evil.test' } })).status).toBe(403);
});
it('caps new users per address per day', async () => {
  vi.stubEnv('IP_DAILY_SESSIONS', '1');
  const headers = { 'x-forwarded-for': '7.7.7.7' };
  expect((await create({ nickname: 'One', role: 'learner', consent: true }, { headers })).status).toBe(201);
  const second = await create({ nickname: 'Two', role: 'learner', consent: true }, { headers });
  expect([second.status, (await second.json()).error.code]).toEqual([429, 'daily_limit']);
});
it('updates nickname and role', async () => {
  const { cookie } = await createTestUser('learner', 'Aisha');
  const res = await call(PATCH, makeRequest('PATCH', '/api/session', { cookie, json: { role: 'korean' } }));
  expect((await res.json()).user).toMatchObject({ nickname: 'Aisha', role: 'korean' });
  expect((await call(PATCH, makeRequest('PATCH', '/api/session', { cookie, json: {} }))).status).toBe(400);
  expect((await call(PATCH, makeRequest('PATCH', '/api/session', { json: { role: 'korean' } }))).status).toBe(401);
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/api/session.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the handlers and the helpers. `POST` order: existing session (return it) → validate → moderation on the nickname → address cap (`countUsersSince` against `limits.ipDailySessions`, skipped for `unknown`) → create → respond 201 with `Set-Cookie: sessionCookieHeader(token)`. `PATCH` moderates a new nickname.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 7 tests.
- [ ] **Step 5: Commit.** `git add src/app/api/session tests/api && git commit -m "feat: session routes"`

---

### Task 6: Missions, points, and rewards routes

**Files:**
- Create: `src/app/api/missions/route.ts`, `src/app/api/points/route.ts`, `src/app/api/rewards/route.ts`
- Test: `tests/api/missions.test.ts`

**Interfaces:**
- Consumes: `getMissions`, `getRewards`, `todaysMissionIds`, `kstDateString`, `missionProgress`, `getPoints`, `recordAttempt`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { GET as missions } from '@/app/api/missions/route';
import { GET as points } from '@/app/api/points/route';
import { GET as rewards } from '@/app/api/rewards/route';
import { getMission, getMissions } from '@/lib/content';
import { recordAttempt } from '@/lib/repo/attempts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call } from './_helpers';

useTestDb();
it('lists missions for a visitor with empty progress', async () => {
  const body = await (await call(missions, makeRequest('GET', '/api/missions'))).json();
  expect(body.missions).toHaveLength(getMissions().length);
  expect(body.missions[0]).toMatchObject({ id: getMissions()[0].id, bestOverall: null, pointsEarned: 0 });
  expect(body.today).toHaveLength(3);
});
it('includes progress for the signed-in user', async () => {
  const { user, cookie } = await createTestUser();
  const m = getMission('cafe-iced-americano')!;
  await recordAttempt({ userId: user.id, mission: m, score: { overall: 88, pronunciation: 88, accuracy: 88, usage: 88, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' } });
  const body = await (await call(missions, makeRequest('GET', '/api/missions', { cookie }))).json();
  expect(body.missions.find((x: { id: string }) => x.id === m.id)).toMatchObject({ bestOverall: 88, pointsEarned: 10 });
  expect(await (await call(points, makeRequest('GET', '/api/points', { cookie }))).json()).toMatchObject({ balance: 10 });
});
it('guards points and serves the reward catalog', async () => {
  expect((await call(points, makeRequest('GET', '/api/points'))).status).toBe(401);
  const body = await (await call(rewards, makeRequest('GET', '/api/rewards'))).json();
  expect(body.rewards.map((r: { id: string }) => r.id)).toEqual(['kpop-album', 'kpop-photocard', 'grocery-10000', 'fashion-10', 'cvs-5000', 'cafe-drink']);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** the three handlers. Missions are returned in file order.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Commit.** `git add src/app/api/missions/route.ts src/app/api/points src/app/api/rewards tests/api/missions.test.ts && git commit -m "feat: missions, points, and rewards routes"`

---

### Task 7: Attempt route

**Files:**
- Create: `src/app/api/missions/[id]/attempts/route.ts`
- Test: `tests/api/attempts.test.ts`, `tests/api/attempts-failures.test.ts`

**Interfaces:**
- Consumes: `validateScoringWav`, `wavRms`, `WavError`, `LIMITS`, `reserveScoringCall`, `finishScoringCall`, `scoreAttempt`, `NoSpeechError`, `ScoringFailedError`, `recordAttempt`, `clientIpHash`.
- Produces: `POST` returning `AttemptResult`; `export const maxDuration = 60`.

- [ ] **Step 1: Write the failing tests**

`tests/api/attempts.test.ts`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { POST, maxDuration } from '@/app/api/missions/[id]/attempts/route';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb, wavFile } from '../helpers/api';
import { silentWav, toneWav } from '../helpers/audio';
import { call } from './_helpers';

useTestDb();
afterEach(() => vi.unstubAllEnvs());
const send = (cookie: string | undefined, id: string, file?: File) => {
  const form = new FormData();
  if (file) form.set('audio', file);
  return call(POST, makeRequest('POST', `/api/missions/${id}/attempts`, { cookie, form }), { id });
};
const calls = async () => (await getDb()).query<{ outcome: string }>('select outcome from hanlog.scoring_calls order by id');

it('scores, pays, and reports what is left', async () => {
  const { cookie } = await createTestUser();
  const res = await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1500)));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ attempt: { missionId: 'cafe-iced-americano', pointsAwarded: 10, score: { overall: 88, scoredBy: 'mock' } }, balance: 10, bestOverall: 88, attemptsLeftToday: 29 });
  expect((await calls()).map((c) => c.outcome)).toEqual(['scored']);
  expect(maxDuration).toBe(60);
});
it('checks in the order the spec gives', async () => {
  const { cookie } = await createTestUser();
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  expect(await code(await send(undefined, 'cafe-iced-americano', wavFile(toneWav(1500))))).toEqual([401, 'unauthenticated']);
  expect(await code(await send(cookie, 'no-such-mission', wavFile(toneWav(1500))))).toEqual([404, 'not_found']);
  expect(await code(await send(cookie, 'cafe-iced-americano'))).toEqual([400, 'invalid_input']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(new Uint8Array(800_000))))).toEqual([413, 'audio_too_large']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(new Uint8Array(5000).fill(7))))).toEqual([415, 'audio_invalid']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1000, { sampleRate: 44100 }))))).toEqual([415, 'audio_invalid']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(toneWav(300))))).toEqual([415, 'audio_invalid']);
  expect(await code(await send(cookie, 'cafe-iced-americano', wavFile(silentWav(1500))))).toEqual([422, 'no_speech']);
  expect(await calls()).toEqual([]);          // nothing above consumed the allowance
});
it('enforces the daily allowance', async () => {
  vi.stubEnv('USER_DAILY_ATTEMPTS', '1');
  const { cookie } = await createTestUser();
  expect((await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1500)))).status).toBe(200);
  const res = await send(cookie, 'cafe-iced-americano', wavFile(toneWav(1500)));
  expect([res.status, (await res.json()).error.code]).toEqual([429, 'daily_limit']);
});
```

`tests/api/attempts-failures.test.ts`:

```ts
import { expect, it, vi } from 'vitest';
import { NoSpeechError, ScoringFailedError } from '@/lib/scoring/types';

vi.mock('@/lib/scoring', async (original) => ({ ...(await original<typeof import('@/lib/scoring')>()), scoreAttempt: vi.fn() }));
import { POST } from '@/app/api/missions/[id]/attempts/route';
import { getDb } from '@/lib/db';
import { scoreAttempt } from '@/lib/scoring';
import { createTestUser, makeRequest, useTestDb, wavFile } from '../helpers/api';
import { toneWav } from '../helpers/audio';
import { call } from './_helpers';

useTestDb();
const send = async (cookie: string) => {
  const form = new FormData();
  form.set('audio', wavFile(toneWav(1500)));
  return call(POST, makeRequest('POST', '/api/missions/cafe-iced-americano/attempts', { cookie, form }), { id: 'cafe-iced-americano' });
};
const state = async () => {
  const db = await getDb();
  return { outcomes: (await db.query<{ outcome: string }>('select outcome from hanlog.scoring_calls')).map((r) => r.outcome), attempts: (await db.query<{ n: number }>('select count(*)::int as n from hanlog.attempts'))[0].n };
};

it('answers 502 and records the failure when the scorer fails', async () => {
  vi.mocked(scoreAttempt).mockRejectedValueOnce(new ScoringFailedError('down'));
  const res = await send((await createTestUser()).cookie);
  expect([res.status, (await res.json()).error.code]).toEqual([502, 'scoring_failed']);
  expect(await state()).toEqual({ outcomes: ['failed'], attempts: 0 });
});
it('answers 422 when the scorer hears nothing', async () => {
  vi.mocked(scoreAttempt).mockRejectedValueOnce(new NoSpeechError());
  const res = await send((await createTestUser()).cookie);
  expect([res.status, (await res.json()).error.code]).toEqual([422, 'no_speech']);
  expect(await state()).toEqual({ outcomes: ['no_speech'], attempts: 0 });
});
it('answers 502 and records the failure on an unexpected scorer error', async () => {
  vi.mocked(scoreAttempt).mockRejectedValueOnce(new Error('surprise'));
  const res = await send((await createTestUser()).cookie);
  expect(res.status).toBe(502);
  expect((await state()).outcomes).toEqual(['failed']);
});
```

- [ ] **Step 2: Run to verify they fail.** Run: `npx vitest run tests/api/attempts.test.ts tests/api/attempts-failures.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** following the check order in spec section 9.3. Map `WavError` code `too_large` to `audio_too_large` and every other `WavError` to `audio_invalid`; reject by `File.size` before reading the bytes.
- [ ] **Step 4: Run to verify they pass.** Expected: PASS, 6 tests.
- [ ] **Step 5: Commit.** `git add "src/app/api/missions/[id]" tests/api/attempts*.test.ts && git commit -m "feat: attempt route with validation, caps, scoring, and awards"`

---

### Task 8: Media validation and storage

**Files:**
- Create: `src/lib/media/sniff.ts`, `src/lib/media/index.ts`, `src/lib/media/local.ts`, `src/lib/media/supabase.ts`
- Modify: `tests/api/_helpers.ts` (add the four helpers below)
- Test: `tests/unit/media/media.test.ts`

**Interfaces:**
- Produces:

```ts
// sniff.ts
export function sniffMedia(bytes: Uint8Array): 'webm' | 'mp4' | 'ogg' | 'wav' | null;

// index.ts
export interface MediaStore {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  remove(paths: string[]): Promise<void>;                 // missing paths are ignored
}
export function getMediaStore(): MediaStore;              // local or supabase, from getConfig().mediaDriver
export function setMediaStoreForTests(store: MediaStore | null): void;
export function createMemoryMediaStore(): MediaStore & { paths(): string[] };
export function validatePeerMedia(file: File | null, kind: unknown, durationMs: unknown): Promise<{ bytes: Uint8Array; mime: string; ext: 'webm' | 'mp4' | 'ogg' | 'wav'; kind: MediaKind; durationMs: number }>;
export function assertSafeMediaPath(path: string): void;  // only [a-z0-9/_.-], no "..", no leading "/"

// added to tests/api/_helpers.ts
export function webmBytes(size?: number): Uint8Array;     // begins 1A 45 DF A3, default 2000 bytes
export function mp4Bytes(size?: number): Uint8Array;      // bytes 4..7 are "ftyp", default 2000 bytes
export function mediaFile(bytes: Uint8Array, type: string): File;
export function useMemoryMedia(): { paths(): string[] };  // installs a fresh createMemoryMediaStore() before each test, removes it after
```

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { assertSafeMediaPath, createMemoryMediaStore, validatePeerMedia } from '@/lib/media';
import { createLocalMediaStore } from '@/lib/media/local';
import { sniffMedia } from '@/lib/media/sniff';
import { mediaFile, mp4Bytes, webmBytes } from '../../api/_helpers';
import { toneWav } from '../../helpers/audio';

it('recognizes containers by magic bytes', () => {
  expect(sniffMedia(webmBytes())).toBe('webm');
  expect(sniffMedia(mp4Bytes())).toBe('mp4');
  expect(sniffMedia(toneWav(100))).toBe('wav');
  expect(sniffMedia(new TextEncoder().encode('OggS' + 'x'.repeat(50)))).toBe('ogg');
  expect(sniffMedia(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  expect(sniffMedia(new Uint8Array(2))).toBeNull();
});
it('accepts consistent uploads, including a codecs suffix', async () => {
  expect(await validatePeerMedia(mediaFile(webmBytes(), 'audio/webm;codecs=opus'), 'audio', '3200')).toMatchObject({ mime: 'audio/webm', ext: 'webm', kind: 'audio', durationMs: 3200 });
  expect(await validatePeerMedia(mediaFile(mp4Bytes(), 'video/mp4'), 'video', 15000)).toMatchObject({ mime: 'video/mp4', ext: 'mp4', kind: 'video' });
});
it('rejects anything inconsistent', async () => {
  const code = (p: Promise<unknown>) => p.then(() => null, (e) => e.code);
  expect(await code(validatePeerMedia(null, 'audio', 1000))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'audio/webm'), 'movie', 1000))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'audio/webm'), 'audio', 'abc'))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'audio/webm'), 'audio', 20001))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'video/webm'), 'audio', 1000))).toBe('media_invalid');   // kind does not match type
  expect(await code(validatePeerMedia(mediaFile(mp4Bytes(), 'audio/webm'), 'audio', 1000))).toBe('media_invalid');    // bytes do not match type
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'text/html'), 'audio', 1000))).toBe('media_invalid');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(4_000_001), 'audio/webm'), 'audio', 1000))).toBe('audio_too_large');
});
it('stores, reads, and removes in memory and on disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hanlog-media-'));
  for (const store of [createMemoryMediaStore(), createLocalMediaStore(dir)]) {
    await store.put('responses/a.webm', webmBytes(100), 'audio/webm');
    expect((await store.get('responses/a.webm'))!.length).toBe(100);
    expect(await store.get('responses/missing.webm')).toBeNull();
    await store.remove(['responses/a.webm', 'responses/missing.webm']);
    expect(await store.get('responses/a.webm')).toBeNull();
  }
  rmSync(dir, { recursive: true, force: true });
});
it('refuses unsafe paths', () => {
  for (const bad of ['../etc/passwd', '/abs/path', 'responses/../../x', 'responses/a b.webm', ''])
    expect(() => assertSafeMediaPath(bad)).toThrow();
  expect(() => assertSafeMediaPath('references/3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11.mp4')).not.toThrow();
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** Magic bytes: WebM `1A 45 DF A3`; MP4 `ftyp` at offset 4; Ogg `OggS`; WAV `RIFF` at 0 and `WAVE` at 8. `validatePeerMedia` checks size from `File.size` before reading. Every store method calls `assertSafeMediaPath`. `local.ts` exports `createLocalMediaStore(dir: string)`. `supabase.ts` exports `createSupabaseMediaStore(url: string, secretKey: string, bucket: string)` using `createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket)` with `upload(path, bytes, { contentType, upsert: true })`, `download(path)`, and `remove(paths)`; check the method signatures against the installed `@supabase/supabase-js` types before relying on them. It is loaded with a dynamic import so the client is never bundled when the driver is local.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/lib/media tests/unit/media tests/api/_helpers.ts && git commit -m "feat: media validation and storage drivers"`

---

### Task 9: Challenges: create, list, detail

**Files:**
- Create: `src/lib/repo/challenges.ts`, `src/app/api/challenges/route.ts`, `src/app/api/challenges/[id]/route.ts`
- Test: `tests/api/challenges.test.ts`

**Interfaces:**
- Consumes: tasks 4 and 8; `CreateChallengeFieldsSchema`, `ChallengeScopeSchema`, `SHARE_CODE_ALPHABET`.
- Produces:

```ts
export type ChallengeRecord = { id: string; code: string; authorId: string; authorNickname: string; korean: string; meaningEn: string; situationEn: string; referencePath: string | null; referenceMime: string | null; isSample: boolean; status: 'open' | 'hidden'; createdAt: string };
export const CHALLENGES_PER_DAY = 10;
export function createChallenge(input: { authorId: string; korean: string; meaningEn: string; situationEn: string }): Promise<ChallengeRecord>;
export function setChallengeReference(id: string, path: string, mime: string): Promise<void>;
export function getChallengeRecord(idOrCode: string): Promise<ChallengeRecord | null>;   // id, or code in any letter case; hidden ones are not returned
export function countChallengesSince(authorId: string, sinceIso: string): Promise<number>;
export function toChallenge(record: ChallengeRecord, viewer: User): Promise<Challenge>;   // fills viewer.responded and viewer.pendingToRate
export function listChallenges(scope: ChallengeScope, viewer: User): Promise<Challenge[]>; // newest first, at most 50
```

Scope meanings: `open` is every open challenge not authored by the viewer; `mine` is authored by the viewer; `to-rate` is challenges the viewer may rate (authored by the viewer, or samples when the viewer's role is `korean`) that have at least one pending, unflagged answer not by the viewer; `answered` is challenges the viewer has answered. `pendingToRate` is 0 for viewers who may not rate.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { GET as list, POST as create } from '@/app/api/challenges/route';
import { GET as detail } from '@/app/api/challenges/[id]/route';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { getSampleChallenges } from '@/lib/content';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, mp4Bytes, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();
const fields = { korean: '이거 완전 꿀잼이야.', meaningEn: '꿀잼 means really fun.', situationEn: 'After a great movie.' };
const post = (cookie: string | undefined, over: Record<string, string | File> = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...fields, ...over })) form.set(k, v);
  return call(create, makeRequest('POST', '/api/challenges', { cookie, form }));
};
const get = async (cookie: string, scope: string) => (await call(list, makeRequest('GET', `/api/challenges?scope=${scope}`, { cookie }))).json();

it('lets a Korean speaker post a challenge with a share code', async () => {
  const { user, cookie } = await createTestUser('korean', 'Minji');
  const res = await post(cookie);
  expect(res.status).toBe(201);
  const { challenge } = await res.json();
  expect(challenge).toMatchObject({ ...fields, author: { id: user.id, nickname: 'Minji' }, hasReference: false, isSample: false, viewer: { responded: false, pendingToRate: 0 } });
  expect(challenge.code).toHaveLength(6);
  expect([...challenge.code].every((ch: string) => SHARE_CODE_ALPHABET.includes(ch))).toBe(true);
});
it('stores an audio reference clip', async () => {
  const { cookie } = await createTestUser('korean');
  const { challenge } = await (await post(cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '2500' })).json();
  expect(challenge.hasReference).toBe(true);
  expect(media.paths()).toEqual([`references/${challenge.id}.webm`]);
  const video = await post(cookie, { media: mediaFile(mp4Bytes(), 'video/mp4'), durationMs: '2500' });
  expect([video.status, (await video.json()).error.code]).toEqual([415, 'media_invalid']);
});
it('refuses learners, bad fields, links, and the eleventh of the day', async () => {
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  expect(await code(await post(undefined))).toEqual([401, 'unauthenticated']);
  expect(await code(await post((await createTestUser('learner')).cookie))).toEqual([403, 'forbidden']);
  const { user, cookie } = await createTestUser('korean');
  expect(await code(await post(cookie, { korean: 'kkuljaem' }))).toEqual([400, 'invalid_input']);
  expect(await code(await post(cookie, { meaningEn: '' }))).toEqual([400, 'invalid_input']);
  expect(await code(await post(cookie, { situationEn: 'see https://x.example' }))).toEqual([422, 'content_rejected']);
  const db = await getDb();
  for (let i = 0; i < 10; i++)
    await db.query(`insert into hanlog.challenges (code, author_id, korean, meaning_en) values ($1, $2, '가', 'm')`, [`ZZZZ${'23456789AB'[i]}Z`, user.id]);
  expect(await code(await post(cookie))).toEqual([429, 'daily_limit']);
});
it('lists by scope', async () => {
  const korean = await createTestUser('korean', 'Minji');
  const learner = await createTestUser('learner', 'Aisha');
  const { challenge } = await (await post(korean.cookie)).json();
  const open = (await get(learner.cookie, 'open')).challenges;
  expect(open[0].id).toBe(challenge.id);                                   // newest first
  expect(open).toHaveLength(1 + getSampleChallenges().length);
  expect((await get(korean.cookie, 'open')).challenges.map((c: { id: string }) => c.id)).not.toContain(challenge.id);
  expect((await get(korean.cookie, 'mine')).challenges.map((c: { id: string }) => c.id)).toEqual([challenge.id]);
  expect((await get(korean.cookie, 'to-rate')).challenges).toEqual([]);
  expect((await get(learner.cookie, 'answered')).challenges).toEqual([]);
  expect((await call(list, makeRequest('GET', '/api/challenges?scope=everything', { cookie: learner.cookie }))).status).toBe(400);
  expect((await call(list, makeRequest('GET', '/api/challenges?scope=open'))).status).toBe(401);
});
it('shows detail by id or by code in any case, with the viewer role', async () => {
  const korean = await createTestUser('korean');
  const other = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const { challenge } = await (await post(korean.cookie)).json();
  const view = async (cookie: string, key: string) => (await call(detail, makeRequest('GET', `/api/challenges/${key}`, { cookie }), { id: key })).json();
  expect(await view(korean.cookie, challenge.id)).toMatchObject({ viewerRole: 'author', myResponse: null, responses: [] });
  expect((await view(learner.cookie, challenge.code.toLowerCase())).challenge.id).toBe(challenge.id);
  expect((await view(learner.cookie, challenge.code)).viewerRole).toBe('visitor');
  expect((await view(other.cookie, challenge.id)).viewerRole).toBe('visitor');
  expect((await view(other.cookie, getSampleChallenges()[0].code)).viewerRole).toBe('rater');
  expect((await call(detail, makeRequest('GET', '/api/challenges/NOPE99', { cookie: learner.cookie }), { id: 'NOPE99' })).status).toBe(404);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** `POST` order: session → role `korean` (403) → fields (400) → moderation on the three fields → daily cap → optional `media` through `validatePeerMedia(file, 'audio', durationMs)` (a non-audio file is `media_invalid`) → `createChallenge` (retry code generation on a unique violation, codes from `crypto.randomInt`) → store at `references/<id>.<ext>` and `setChallengeReference`. Detail `viewerRole`: `author` if the viewer wrote it; else `responder` if the viewer has an answer (task 10 adds this); else `rater` if it is a sample and the viewer's role is `korean`; else `visitor`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/lib/repo/challenges.ts src/app/api/challenges tests/api/challenges.test.ts && git commit -m "feat: challenges create, list, and detail"`

---

### Task 10: Answers

**Files:**
- Create: `src/lib/repo/responses.ts`, `src/app/api/challenges/[id]/responses/route.ts`
- Modify: `src/lib/repo/challenges.ts` (scopes `to-rate` and `answered`, `viewer` counts), `src/app/api/challenges/[id]/route.ts` (fill `myResponse` and `responses`)
- Test: `tests/api/responses.test.ts`

**Interfaces:**
- Produces:

```ts
export type ResponseRecord = ChallengeResponse & { mediaPath: string | null; mediaMime: string; flagged: boolean; raterId: string | null; challengeAuthorId: string; challengeIsSample: boolean };
export const RESPONSES_PER_DAY = 30;
export function upsertResponse(input: { challengeId: string; responderId: string; mediaKind: MediaKind; mediaMime: string; ext: string; durationMs: number }): Promise<{ record: ResponseRecord; replacedPath: string | null }>; // sets media_path to responses/<id>.<ext>; ApiError('conflict') if already rated
export function getResponseRecord(id: string): Promise<ResponseRecord | null>;
export function getMyResponse(challengeId: string, responderId: string): Promise<ChallengeResponse | null>;
export function listResponses(challengeId: string): Promise<ChallengeResponse[]>;   // unflagged; pending first, then newest
export function countResponsesSince(responderId: string, sinceIso: string): Promise<number>;
export function canView(record: ResponseRecord, viewer: User): boolean;   // the responder, the challenge author, or a korean user on a sample
export function canRate(record: ResponseRecord, viewer: User): boolean;   // the challenge author, or a korean user on a sample; never the responder
```

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { GET as list, POST as create } from '@/app/api/challenges/route';
import { GET as detail } from '@/app/api/challenges/[id]/route';
import { POST as answer } from '@/app/api/challenges/[id]/responses/route';
import { PATCH as patchSession } from '@/app/api/session/route';
import { getSampleChallenges } from '@/lib/content';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, mp4Bytes, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();
const newChallenge = async (cookie: string) => {
  const form = new FormData();
  form.set('korean', '이거 완전 꿀잼이야.'); form.set('meaningEn', 'Really fun.'); form.set('situationEn', '');
  return (await (await call(create, makeRequest('POST', '/api/challenges', { cookie, form }))).json()).challenge;
};
const send = (cookie: string | undefined, id: string, file = mediaFile(webmBytes(), 'audio/webm'), kind = 'audio') => {
  const form = new FormData();
  form.set('media', file); form.set('kind', kind); form.set('durationMs', '3000');
  return call(answer, makeRequest('POST', `/api/challenges/${id}/responses`, { cookie, form }), { id });
};
const view = async (cookie: string, id: string) => (await call(detail, makeRequest('GET', `/api/challenges/${id}`, { cookie }), { id })).json();
const scope = async (cookie: string, s: string) => (await (await call(list, makeRequest('GET', `/api/challenges?scope=${s}`, { cookie }))).json()).challenges;

it('accepts an answer and shows it to both sides', async () => {
  const korean = await createTestUser('korean', 'Minji');
  const learner = await createTestUser('learner', 'Aisha');
  const challenge = await newChallenge(korean.cookie);
  const res = await send(learner.cookie, challenge.id);
  expect(res.status).toBe(201);
  const { response } = await res.json();
  expect(response).toMatchObject({ challengeId: challenge.id, responder: { id: learner.user.id, nickname: 'Aisha' }, mediaKind: 'audio', mediaAvailable: true, durationMs: 3000, status: 'pending', rating: null, feedback: null });
  expect(media.paths()).toEqual([`responses/${response.id}.webm`]);
  expect(await view(learner.cookie, challenge.id)).toMatchObject({ viewerRole: 'responder', myResponse: { id: response.id }, responses: [] });
  expect((await view(korean.cookie, challenge.id)).responses.map((r: { id: string }) => r.id)).toEqual([response.id]);
  expect((await scope(learner.cookie, 'answered')).map((c: { id: string }) => c.id)).toEqual([challenge.id]);
  expect((await scope(learner.cookie, 'open')).find((c: { id: string }) => c.id === challenge.id).viewer.responded).toBe(true);
  expect(await scope(korean.cookie, 'to-rate')).toMatchObject([{ id: challenge.id, viewer: { pendingToRate: 1 } }]);
});
it('replaces a pending answer and removes the old file', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  const first = (await (await send(learner.cookie, challenge.id)).json()).response;
  const second = (await (await send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'video/mp4'), 'video')).json()).response;
  expect(second).toMatchObject({ id: first.id, mediaKind: 'video' });
  expect(media.paths()).toEqual([`responses/${first.id}.mp4`]);
});
it('lets any Korean speaker see answers to a sample challenge', async () => {
  const learner = await createTestUser('learner');
  const korean = await createTestUser('korean');
  const sample = (await view(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await send(learner.cookie, sample.id)).json();
  expect(await view(korean.cookie, sample.id)).toMatchObject({ viewerRole: 'rater', responses: [{ id: response.id }] });
  expect((await scope(korean.cookie, 'to-rate')).map((c: { id: string }) => c.id)).toEqual([sample.id]);
});
it('refuses the wrong people and the wrong files', async () => {
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await newChallenge(korean.cookie);
  expect(await code(await send(undefined, challenge.id))).toEqual([401, 'unauthenticated']);
  expect(await code(await send(korean.cookie, challenge.id))).toEqual([403, 'forbidden']);                   // role korean
  await call(patchSession, makeRequest('PATCH', '/api/session', { cookie: korean.cookie, json: { role: 'learner' } }));
  expect(await code(await send(korean.cookie, challenge.id))).toEqual([403, 'forbidden']);                   // own challenge after switching role
  expect(await code(await send(learner.cookie, '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11'))).toEqual([404, 'not_found']);
  expect(await code(await send(learner.cookie, challenge.id, mediaFile(mp4Bytes(), 'audio/webm')))).toEqual([415, 'media_invalid']);
  expect(await code(await send(learner.cookie, challenge.id, mediaFile(webmBytes(4_000_001), 'audio/webm')))).toEqual([413, 'audio_too_large']);
  expect(media.paths()).toEqual([]);
});
it('caps answers per day', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const db = await getDb();
  for (let i = 0; i < 30; i++) {
    const [{ id }] = await db.query<{ id: string }>(`insert into hanlog.challenges (code, author_id, korean, meaning_en) values ($1, $2, '가', 'm') returning id`, [`T${1000 + i}Z`, korean.user.id]);
    await db.query(`insert into hanlog.challenge_responses (challenge_id, responder_id, media_path, media_kind, media_mime, duration_ms) values ($1, $2, 'responses/x.webm', 'audio', 'audio/webm', 1000)`, [id, learner.user.id]);
  }
  const res = await send(learner.cookie, (await newChallenge(korean.cookie)).id);
  expect([res.status, (await res.json()).error.code]).toEqual([429, 'daily_limit']);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** `POST` order: session → role `learner` (403) → challenge exists and is open (404) → not the author (403) → daily cap → `validatePeerMedia` → `upsertResponse` → store the new file → remove `replacedPath` if it differs → 201. If storing fails, delete the row (or restore the previous path) so no row points at a missing file.
- [ ] **Step 4: Run to verify it passes, and rerun task 9's tests.** Expected: PASS, 5 new tests; task 9 still green.
- [ ] **Step 5: Commit.** `git add src/lib/repo src/app/api/challenges tests/api/responses.test.ts && git commit -m "feat: challenge answers with replace-until-rated"`

---

### Task 11: Rating, feedback, report

**Files:**
- Create: `src/app/api/responses/[id]/rating/route.ts`, `src/app/api/responses/[id]/feedback/route.ts`, `src/app/api/responses/[id]/report/route.ts`
- Modify: `src/lib/repo/responses.ts`
- Test: `tests/api/ratings.test.ts`

**Interfaces:**
- Consumes: points rules (task 1), `addPointEvent` (task 3), `assertTextAllowed` (task 4), `RatingInputSchema`, `FeedbackInputSchema`.
- Produces:

```ts
export function rateResponse(input: { responseId: string; raterId: string; pronunciation: number; naturalness: number; comment: string }): Promise<ChallengeResponse>; // ApiError('conflict') if not pending
export function giveFeedback(input: { responseId: string; helpfulness: number; comment: string }): Promise<ChallengeResponse>;                                        // ApiError('conflict') unless rated and no feedback yet
export function flagResponse(id: string): Promise<void>;
```

- [ ] **Step 1: Write the failing test**

Reuse the `newChallenge`, `send`, `view`, and `scope` helpers from task 10 by moving them into `tests/api/_helpers.ts` as `postChallenge(cookie)`, `postAnswer(cookie, challengeId, file?, kind?)`, `viewChallenge(cookie, idOrCode)`, `listScope(cookie, scope)`, and update task 10's test to import them.

```ts
import { expect, it } from 'vitest';
import { POST as feedback } from '@/app/api/responses/[id]/feedback/route';
import { POST as rating } from '@/app/api/responses/[id]/rating/route';
import { POST as report } from '@/app/api/responses/[id]/report/route';
import { getSampleChallenges } from '@/lib/content';
import { getPoints } from '@/lib/repo/points';
import { deleteUserCascade } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, listScope, postAnswer, postChallenge, useMemoryMedia, viewChallenge } from './_helpers';

useTestDb();
useMemoryMedia();
const rate = (cookie: string | undefined, id: string, json: unknown = { pronunciation: 4, naturalness: 5, comment: '좋아요!' }) => call(rating, makeRequest('POST', `/api/responses/${id}/rating`, { cookie, json }), { id });
const thank = (cookie: string | undefined, id: string, json: unknown = { helpfulness: 5, comment: 'Thanks!' }) => call(feedback, makeRequest('POST', `/api/responses/${id}/feedback`, { cookie, json }), { id });
const flag = (cookie: string | undefined, id: string) => call(report, makeRequest('POST', `/api/responses/${id}/report`, { cookie }), { id });
const code = async (res: Response) => [res.status, (await res.json()).error.code];
const setup = async () => {
  const korean = await createTestUser('korean', 'Minji');
  const learner = await createTestUser('learner', 'Aisha');
  const challenge = await postChallenge(korean.cookie);
  const { response } = await (await postAnswer(learner.cookie, challenge.id)).json();
  return { korean, learner, challenge, response };
};

it('rates once and pays both people', async () => {
  const { korean, learner, response } = await setup();
  const res = await rate(korean.cookie, response.id);
  expect(res.status).toBe(200);
  expect((await res.json()).response).toMatchObject({ status: 'rated', rating: { pronunciation: 4, naturalness: 5, comment: '좋아요!' } });
  expect(await getPoints(learner.user.id)).toMatchObject({ balance: 27, events: [{ delta: 27, reason: 'peer_response', label: 'Your answer was rated' }] });
  expect(await getPoints(korean.user.id)).toMatchObject({ balance: 10, events: [{ delta: 10, reason: 'peer_rating', label: 'You rated an answer' }] });
  expect(await code(await rate(korean.cookie, response.id))).toEqual([409, 'conflict']);
  expect((await getPoints(learner.user.id)).balance).toBe(27);
});
it('only lets the right person rate', async () => {
  const { korean, learner, response } = await setup();
  expect(await code(await rate(undefined, response.id))).toEqual([401, 'unauthenticated']);
  expect(await code(await rate(learner.cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await rate((await createTestUser('korean')).cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await rate((await createTestUser('learner')).cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await rate(korean.cookie, '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11'))).toEqual([404, 'not_found']);
  expect(await code(await rate(korean.cookie, response.id, { pronunciation: 0, naturalness: 5, comment: '' }))).toEqual([400, 'invalid_input']);
  expect(await code(await rate(korean.cookie, response.id, { pronunciation: 3, naturalness: 3, comment: 'visit www.x.example' }))).toEqual([422, 'content_rejected']);
});
it('lets any Korean speaker rate an answer to a sample', async () => {
  const learner = await createTestUser('learner');
  const anyKorean = await createTestUser('korean');
  const sample = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await postAnswer(learner.cookie, sample.id)).json();
  expect((await rate(anyKorean.cookie, response.id)).status).toBe(200);
  expect((await getPoints(anyKorean.user.id)).balance).toBe(10);
});
it('takes feedback once, after the rating, from the responder only', async () => {
  const { korean, learner, response } = await setup();
  expect(await code(await thank(learner.cookie, response.id))).toEqual([409, 'conflict']);          // not rated yet
  await rate(korean.cookie, response.id);
  expect(await code(await thank(korean.cookie, response.id))).toEqual([403, 'forbidden']);
  expect(await code(await thank(learner.cookie, response.id, { helpfulness: 6, comment: '' }))).toEqual([400, 'invalid_input']);
  const res = await thank(learner.cookie, response.id);
  expect((await res.json()).response.feedback).toMatchObject({ helpfulness: 5, comment: 'Thanks!' });
  expect((await getPoints(learner.user.id)).events[0]).toMatchObject({ delta: 5, reason: 'peer_feedback', label: 'Thanks for your feedback' });
  expect((await getPoints(korean.user.id)).events[0]).toMatchObject({ delta: 10, reason: 'peer_feedback', label: 'Feedback on your rating' });
  expect(await code(await thank(learner.cookie, response.id))).toEqual([409, 'conflict']);
});
it('still accepts feedback after the rater deleted their account', async () => {
  const learner = await createTestUser('learner');
  const rater = await createTestUser('korean');
  const sample = (await viewChallenge(learner.cookie, getSampleChallenges()[0].code)).challenge;
  const { response } = await (await postAnswer(learner.cookie, sample.id)).json();
  await rate(rater.cookie, response.id);
  await deleteUserCascade(rater.user.id);
  expect((await thank(learner.cookie, response.id)).status).toBe(200);
});
it('hides a reported answer everywhere', async () => {
  const { korean, learner, challenge, response } = await setup();
  expect(await code(await flag((await createTestUser('learner')).cookie, response.id))).toEqual([403, 'forbidden']);
  expect((await flag(korean.cookie, response.id)).status).toBe(204);
  expect((await viewChallenge(korean.cookie, challenge.id)).responses).toEqual([]);
  expect(await listScope(korean.cookie, 'to-rate')).toEqual([]);
  expect(await code(await rate(korean.cookie, response.id))).toEqual([404, 'not_found']);
  expect((await viewChallenge(learner.cookie, challenge.id)).myResponse).toMatchObject({ id: response.id, mediaAvailable: false });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** `rateResponse` and `giveFeedback` each run in one transaction, re-reading the row inside it (`select ... for update`) before changing it, then adding the point events from spec section 6 with `refId` the response id. The feedback event for the rater is skipped when `rater_id` is null. A flagged answer is `not_found` for rating, feedback, and media; the responder still sees it in `myResponse` with `mediaAvailable: false`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 6 tests.
- [ ] **Step 5: Commit.** `git add src/lib/repo/responses.ts "src/app/api/responses" tests/api && git commit -m "feat: peer rating, feedback, and reporting"`

---

### Task 12: Media delivery

**Files:**
- Create: `src/app/api/responses/[id]/media/route.ts`, `src/app/api/challenges/[id]/reference/route.ts`
- Test: `tests/api/media.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { GET as reference } from '@/app/api/challenges/[id]/reference/route';
import { GET as responseMedia } from '@/app/api/responses/[id]/media/route';
import { POST as report } from '@/app/api/responses/[id]/report/route';
import { getMediaStore } from '@/lib/media';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
useMemoryMedia();
const fetchMedia = (cookie: string | undefined, id: string) => call(responseMedia, makeRequest('GET', `/api/responses/${id}/media`, { cookie }), { id });

it('serves an answer to the people entitled to it, with safe headers', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await postChallenge(korean.cookie);
  const bytes = webmBytes(1234);
  const { response } = await (await postAnswer(learner.cookie, challenge.id, mediaFile(bytes, 'audio/webm;codecs=opus'))).json();
  for (const cookie of [korean.cookie, learner.cookie]) {
    const res = await fetchMedia(cookie, response.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/webm');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  }
  expect((await fetchMedia(undefined, response.id)).status).toBe(401);
  expect((await fetchMedia((await createTestUser('learner')).cookie, response.id)).status).toBe(403);
  expect((await fetchMedia((await createTestUser('korean')).cookie, response.id)).status).toBe(403);
});
it('answers 404 for reported, missing, or unknown media', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const challenge = await postChallenge(korean.cookie);
  const a = (await (await postAnswer(learner.cookie, challenge.id)).json()).response;
  await getMediaStore().remove([`responses/${a.id}.webm`]);                  // file gone, row still points at it
  expect((await fetchMedia(korean.cookie, a.id)).status).toBe(404);
  await call(report, makeRequest('POST', `/api/responses/${a.id}/report`, { cookie: korean.cookie }), { id: a.id });
  expect((await fetchMedia(learner.cookie, a.id)).status).toBe(404);
  expect((await fetchMedia(korean.cookie, '3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11')).status).toBe(404);
});
it('serves a reference clip to any signed-in user', async () => {
  const korean = await createTestUser('korean');
  const withClip = await postChallenge(korean.cookie, { media: mediaFile(webmBytes(500), 'audio/webm'), durationMs: '2000' });
  const without = await postChallenge(korean.cookie);
  const get = (cookie: string | undefined, id: string) => call(reference, makeRequest('GET', `/api/challenges/${id}/reference`, { cookie }), { id });
  const res = await get((await createTestUser('learner')).cookie, withClip.id);
  expect([res.status, res.headers.get('content-type'), (await res.arrayBuffer()).byteLength]).toEqual([200, 'audio/webm', 500]);
  expect((await get(korean.cookie, without.id)).status).toBe(404);
  expect((await get(undefined, withClip.id)).status).toBe(401);
});
```

`postChallenge(cookie, extra?)` accepts extra form fields; extend the helper accordingly.

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** Authorization for answers uses `canView`. The body is the stored bytes; headers as in spec section 9.3.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Commit.** `git add src/app/api tests/api && git commit -m "feat: authorized media delivery"`

---

### Task 13: Delete my data

**Files:**
- Modify: `src/app/api/session/route.ts` (add `DELETE`)
- Test: `tests/api/account.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from 'vitest';
import { DELETE, GET } from '@/app/api/session/route';
import { getDb } from '@/lib/db';
import { getUser } from '@/lib/repo/users';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();

it('removes the user, their rows, and their recordings, and nothing else', async () => {
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const bystander = await createTestUser('learner');
  const mine = await postChallenge(korean.cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '1000' });
  await postAnswer(learner.cookie, mine.id);                                     // answer to the challenge being deleted
  const other = await postChallenge((await createTestUser('korean')).cookie);
  const kept = (await (await postAnswer(bystander.cookie, other.id)).json()).response;

  const res = await call(DELETE, makeRequest('DELETE', '/api/session', { cookie: korean.cookie }));
  expect(res.status).toBe(204);
  expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(await getUser(korean.user.id)).toBeNull();
  expect(media.paths()).toEqual([`responses/${kept.id}.webm`]);
  expect((await (await call(GET, makeRequest('GET', '/api/session', { cookie: korean.cookie }))).json()).user).toBeNull();
  expect((await (await getDb()).query<{ n: number }>('select count(*)::int as n from hanlog.challenges where not is_sample'))[0].n).toBe(1);
  expect(await getUser(learner.user.id)).not.toBeNull();
});
it('needs a session', async () => {
  expect((await call(DELETE, makeRequest('DELETE', '/api/session'))).status).toBe(401);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** `deleteUserCascade` then `getMediaStore().remove(paths)`; a storage failure is logged and does not fail the request (the cleanup job in task 14 cannot find orphans, so log the paths).
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 2 tests.
- [ ] **Step 5: Commit.** `git add src/app/api/session tests/api/account.test.ts && git commit -m "feat: delete my data"`

---

### Task 14: Recording expiry and Vercel configuration

**Files:**
- Create: `src/lib/media/cleanup.ts`, `src/app/api/cron/cleanup/route.ts`, `vercel.ts`
- Test: `tests/api/cleanup.test.ts`

**Interfaces:**
- Produces: `export function cleanupExpiredMedia(now?: Date): Promise<number>;` Deletes stored files for answers and reference clips older than `retentionDays`, sets their path columns to null, returns how many files it removed.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/cron/cleanup/route';
import { getDb } from '@/lib/db';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, mediaFile, postAnswer, postChallenge, useMemoryMedia, viewChallenge, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();
afterEach(() => vi.unstubAllEnvs());
const run = (auth?: string) => call(GET, makeRequest('GET', '/api/cron/cleanup', { headers: auth ? { authorization: auth } : {} }));

it('refuses callers without the secret', async () => {
  expect((await run()).status).toBe(401);                     // no secret configured
  vi.stubEnv('CRON_SECRET', 's3cret');
  expect((await run()).status).toBe(401);
  expect((await run('Bearer wrong')).status).toBe(401);
});
it('deletes recordings past retention and keeps fresh ones', async () => {
  vi.stubEnv('CRON_SECRET', 's3cret');
  const korean = await createTestUser('korean');
  const learner = await createTestUser('learner');
  const old = await postChallenge(korean.cookie, { media: mediaFile(webmBytes(), 'audio/webm'), durationMs: '1000' });
  const oldAnswer = (await (await postAnswer(learner.cookie, old.id)).json()).response;
  const fresh = await postChallenge(korean.cookie);
  const freshAnswer = (await (await postAnswer(learner.cookie, fresh.id)).json()).response;
  const db = await getDb();
  await db.query(`update hanlog.challenges set created_at = now() - interval '15 days' where id = $1`, [old.id]);
  await db.query(`update hanlog.challenge_responses set created_at = now() - interval '15 days' where id = $1`, [oldAnswer.id]);

  const res = await run('Bearer s3cret');
  expect(await res.json()).toEqual({ deleted: 2 });
  expect(media.paths()).toEqual([`responses/${freshAnswer.id}.webm`]);
  const detail = await viewChallenge(learner.cookie, old.id);
  expect(detail.challenge.hasReference).toBe(false);
  expect(detail.myResponse.mediaAvailable).toBe(false);
  expect(await (await run('Bearer s3cret')).json()).toEqual({ deleted: 0 });
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement the cleanup and the route.** Compare the bearer token with a constant-time comparison.
- [ ] **Step 4: Write `vercel.ts`.** Read the type definitions shipped in `node_modules/@vercel/config` first. Export a config with framework `nextjs`, one cron `{ path: '/api/cron/cleanup', schedule: '0 18 * * *' }`, and the function region set to Seoul (`icn1`) using whatever field those types provide for regions.
- [ ] **Step 5: Run to verify it passes, then the whole suite and a build.** Run: `npm run check && npm run build`. Expected: PASS; the build lists every route in spec section 9.3.
- [ ] **Step 6: Commit.** `git add src/lib/media/cleanup.ts src/app/api/cron vercel.ts tests/api/cleanup.test.ts && git commit -m "feat: recording expiry job and Vercel configuration"`

---

### Task 15: Migration script and a run against real Postgres

**Files:**
- Create: `scripts/migrate.ts`, `tests/api/pg.live.test.ts`, `docs/handoffs/backend.md`

**Interfaces:**
- Produces: `npm run db:migrate`: requires `DATABASE_URL` (or `POSTGRES_URL`), applies pending migrations with `applyMigrations`, runs `ensureSeed`, prints the names applied, exits non-zero on failure.

- [ ] **Step 1: Write the live test (skipped without `TEST_DATABASE_URL`)**

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('real Postgres', () => {
  beforeAll(() => { vi.stubEnv('DATABASE_URL', url!); vi.stubEnv('USER_DAILY_ATTEMPTS', '5'); });
  afterAll(() => vi.unstubAllEnvs());

  it('pays a mission once under real concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { recordAttempt } = await import('@/lib/repo/attempts');
    const { getMission } = await import('@/lib/content');
    const user = await createUser({ nickname: 'pg-live', role: 'learner', ipHash: `live-${Date.now()}` });
    const score = { overall: 90, pronunciation: 90, accuracy: 90, usage: 90, heard: 'h', issues: [], praise: 'p', nextTip: 't', scoredBy: 'mock' as const };
    const results = await Promise.all(Array.from({ length: 8 }, () => recordAttempt({ userId: user.id, mission: getMission('campus-group-roles')!, score })));
    expect(results.reduce((sum, r) => sum + r.attempt.pointsAwarded, 0)).toBe(30);
  });
  it('never exceeds the cap under real concurrency', async () => {
    const { createUser } = await import('@/lib/repo/users');
    const { reserveScoringCall } = await import('@/lib/limits');
    const user = await createUser({ nickname: 'pg-live-2', role: 'learner', ipHash: `live2-${Date.now()}` });
    const settled = await Promise.allSettled(Array.from({ length: 12 }, () => reserveScoringCall({ userId: user.id, ipHash: 'unknown' })));
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Write `scripts/migrate.ts`**

- [ ] **Step 3: Run against a throwaway Postgres**

```bash
docker run --rm -d --name hanlog-pg -e POSTGRES_PASSWORD=pw -p 54329:5432 postgres:17
DATABASE_URL=postgres://postgres:pw@localhost:54329/postgres npm run db:migrate
DATABASE_URL=postgres://postgres:pw@localhost:54329/postgres npm run db:migrate
TEST_DATABASE_URL=postgres://postgres:pw@localhost:54329/postgres npx vitest run tests/api/pg.live.test.ts
docker stop hanlog-pg
```

Expected: the first migrate prints `0001_init.sql`; the second prints nothing applied; both live tests pass. If Docker is not running, say so in the handoff and leave this step for plan 07; do not skip it silently.

- [ ] **Step 4: Write `docs/handoffs/backend.md` and commit**

List each route with its test file, every environment variable read, deviations, and whether step 3 ran.

```bash
git add scripts/migrate.ts tests/api/pg.live.test.ts docs/handoffs/backend.md && git commit -m "feat: migration runner and real-Postgres concurrency checks"
```
