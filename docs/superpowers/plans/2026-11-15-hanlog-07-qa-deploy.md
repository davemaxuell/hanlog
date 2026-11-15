# HanLog QA and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the merged application works end to end in a real browser, close the gaps unit tests cannot see, put it on a public HTTPS address with real scoring, and leave an honest handoff.

**Architecture:** Playwright drives a production build that runs with the mock scorer, in-memory PGlite, and a fake microphone fed from a generated WAV file. Deployment is Vercel for the application and Supabase for Postgres and Storage. Every defect found is fixed with a test that shows it first.

**Tech Stack:** Playwright 1.65 (Chromium), `@axe-core/playwright`, Vercel CLI, Supabase, the repository's own migration runner.

**Spec:** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, sections 2, 11, 12, 15, 16, 18. Orchestration: `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`. Read every file in `docs/handoffs/` before starting.

## Global Constraints

- You run alone on `main` after all workstream branches are merged. You may edit any path to fix a defect, and you may add test-only dependencies.
- A defect fix starts with a failing test at the lowest level that can show it (unit before API before end to end).
- End to end tests run against `next build` plus `next start`, never the dev server, with `SCORING_PROVIDER=mock`.
- No real secret is ever written to a tracked file, a test, a log, or a command you paste into a handoff. Production secrets go straight into Vercel's environment settings.
- Deploying to production and anything that costs money is the owner's decision. Deploy a preview first, show the owner the preview address, and promote to production only after they say so.
- Tests are never run against the production database.

## Review Focus

1. A phone browser that records MP4 instead of WebM (Safari). No automated test covers it: pinned by the device checklist in task 9.
2. Two people using the peer loop at the same time in separate browsers. Pinned in task 3.
3. A secret, or the scoring provider's address, present in a client bundle. Pinned in task 6.
4. A page that scrolls sideways or traps keyboard focus at phone width. Pinned in task 5.
5. Production configured without a required variable, silently falling back to mock scoring or a development secret. Pinned in tasks 7 and 8.

---

### Task 1: Integrate and bring up Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `.gitignore` (add `tests/e2e/fixtures/`), `package.json` (dev dependency)

**Interfaces:**
- Produces in `tests/e2e/helpers.ts`:

```ts
export async function onboard(page: Page, opts: { nickname: string; role: 'learner' | 'korean'; next?: string }): Promise<void>; // fills /app/onboarding and waits for the redirect
export async function recordFor(page: Page, ms: number): Promise<void>;   // taps Record, waits ms, taps Stop
export async function balance(page: Page): Promise<number>;               // reads the points chip
```

- [ ] **Step 1: Confirm the merged tree is healthy**

Run: `npm ci && npm run check && npm run build`
Expected: PASS. If anything fails, fix it first (failing test, then fix) and note it in the handoff.

- [ ] **Step 2: Install and configure**

```bash
npm install --save-dev --save-exact @axe-core/playwright
npx playwright install chromium
```

`playwright.config.ts`:
- `testDir: 'tests/e2e'`, `globalSetup: './tests/e2e/global-setup.ts'`, `fullyParallel: false`, `workers: 1` (one in-memory database is shared by all tests).
- `webServer`: command `npm run build && npx next start -p 3100`, url `http://localhost:3100`, `reuseExistingServer: false`, timeout 240 000 ms, env `{ NODE_ENV: 'production', SCORING_PROVIDER: 'mock', SESSION_SECRET: 'e2e-session-secret-0123456789abcdef', CRON_SECRET: 'e2e-cron' }`.
- `use`: `baseURL: 'http://localhost:3100'`, `permissions: ['microphone', 'camera']`, launch args `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, and `--use-file-for-fake-audio-capture=<absolute path>/tests/e2e/fixtures/voice.wav`.
- Projects: `phone` (Chromium, viewport 390 by 844, touch, mobile user agent) and `desktop` (Chromium, 1440 by 900).

`global-setup.ts` writes `tests/e2e/fixtures/voice.wav`: six seconds, 48 000 Hz, 440 Hz tone at amplitude 0.5, built with `encodeWavPcm16` from `src/lib/audio/wav.ts`.

- [ ] **Step 3: Write the smoke test**

```ts
import { expect, test } from '@playwright/test';

test('the introduction page loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Speak Korean out in the world. Get a score that actually helps.');
  expect(errors).toEqual([]);
});
test('the API is up and has no session', async ({ request }) => {
  expect(await (await request.get('/api/session')).json()).toEqual({ user: null });
  expect((await (await request.get('/api/missions')).json()).missions).toHaveLength(24);
});
```

- [ ] **Step 4: Run.** Run: `npm run test:e2e`. Expected: PASS, 2 tests in each project.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "test: Playwright setup with fake microphone"`

---

### Task 2: Solo loop end to end

**Files:**
- Create: `tests/e2e/solo.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
import { expect, test } from '@playwright/test';
import { balance, onboard, recordFor } from './helpers';

test('a visitor scores a sentence on the introduction page and carries the points into the app', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Try a mission now' }).click();
  await expect(page.getByRole('button', { name: 'Record' })).toHaveCount(0);            // nothing before consent
  await page.getByRole('checkbox', { name: /I agree that my voice recordings/ }).check();
  await recordFor(page, 2500);
  await page.getByRole('button', { name: 'Get my score' }).click();
  await expect(page.getByText('88', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Demo scoring, not AI')).toBeVisible();
  await expect(page.getByText('+10 points')).toBeVisible();
  await page.getByRole('link', { name: 'Keep going in the app' }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(await balance(page)).toBe(10);
});
test('a new learner onboards, completes a mission, and cannot be paid twice', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/onboarding\?next=%2Fapp$/);
  await onboard(page, { nickname: 'Aisha', role: 'learner' });
  await expect(page.getByText('안녕하세요, Aisha')).toBeVisible();
  await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().click();
  for (const expected of [/^\+\d+ points$/, 'Already earned for this mission.']) {
    await recordFor(page, 2500);
    await page.getByRole('button', { name: 'Get my score' }).click();
    await expect(page.getByRole('meter', { name: 'Pronunciation' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(expected)).toBeVisible();
    if (typeof expected !== 'string') await page.getByRole('button', { name: 'Try again' }).click();
  }
  await page.getByRole('link', { name: 'Rewards' }).click();
  await expect(page.getByText(/^Mission: /)).toHaveCount(1);
});
test('a denied microphone still leaves a way to get a score', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await page.goto('/app');
  await onboard(page, { nickname: 'NoMic', role: 'learner' });
  await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().click();
  await page.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access is off.');
  await page.getByLabel('Upload a voice file').setInputFiles('tests/e2e/fixtures/voice.wav');
  await page.getByRole('button', { name: 'Get my score' }).click();
  await expect(page.getByRole('meter', { name: 'Pronunciation' })).toBeVisible({ timeout: 20_000 });
});
test('the session survives a reload and Delete my data ends it', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Temp', role: 'learner' });
  await page.reload();
  await expect(page.getByText('안녕하세요, Temp')).toBeVisible();
  await page.getByRole('link', { name: 'Me' }).click();
  await page.getByRole('button', { name: 'Delete my data' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/onboarding/);
});
```

- [ ] **Step 2: Run.** Run: `npx playwright test tests/e2e/solo.spec.ts`. Expected: PASS in both projects. A failure here is a real defect: reproduce it in a unit or component test, fix, rerun.
- [ ] **Step 3: Commit.** `git add tests/e2e && git commit -m "test: solo loop end to end"`

---

### Task 3: Peer loop end to end

**Files:**
- Create: `tests/e2e/peer.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { expect, test } from '@playwright/test';
import { balance, onboard, recordFor } from './helpers';

test('a Korean speaker and a learner complete one exchange in two browsers', async ({ browser }) => {
  const koreanContext = await browser.newContext();
  const learnerContext = await browser.newContext();
  const korean = await koreanContext.newPage();
  const learner = await learnerContext.newPage();

  await korean.goto('/app');
  await onboard(korean, { nickname: 'Minji', role: 'korean' });
  await korean.getByRole('link', { name: 'Post a challenge' }).first().click();
  await korean.getByLabel('Korean expression').fill('이거 완전 꿀잼이야.');
  await korean.getByLabel('Meaning in English').fill('꿀잼 means really fun.');
  await korean.getByRole('button', { name: 'Post challenge' }).click();
  const code = (await korean.getByTestId('share-code').textContent())!.trim();
  expect(code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);

  await learner.goto(`/c/${code}`);
  await onboard(learner, { nickname: 'Aisha', role: 'learner', next: `/c/${code}` });
  await expect(learner.getByText('이거 완전 꿀잼이야.')).toBeVisible();
  await recordFor(learner, 2500);
  await learner.getByRole('button', { name: 'Send answer' }).click();
  await expect(learner.getByText('Sent. Minji will rate it.')).toBeVisible();

  await korean.getByRole('link', { name: 'Challenges' }).click();
  await expect(korean.getByRole('heading', { name: 'To rate (1)' })).toBeVisible();
  await korean.getByRole('region', { name: /To rate/ }).getByRole('link').first().click();
  const card = korean.getByRole('article', { name: 'Answer from Aisha' });
  await card.getByRole('button', { name: 'Play' }).click();
  await expect(card.locator('audio')).toHaveAttribute('src', /^blob:/);
  await card.getByRole('radiogroup', { name: 'Pronunciation' }).getByRole('radio', { name: '4 stars' }).check();
  await card.getByRole('radiogroup', { name: 'Naturalness' }).getByRole('radio', { name: '5 stars' }).check();
  await card.getByRole('button', { name: 'Send rating' }).click();
  await expect(card.getByText('Rated. Thank you.')).toBeVisible();

  await learner.reload();
  await expect(learner.getByRole('img', { name: 'Pronunciation: 4 out of 5' })).toBeVisible();
  await learner.getByRole('radio', { name: '5 stars' }).check();
  await learner.getByRole('button', { name: 'Send feedback' }).click();
  await expect(learner.getByText('Thanks. Your feedback was sent.')).toBeVisible();

  await learner.reload();
  await korean.reload();
  expect(await balance(learner)).toBe(32);   // 27 for the rated answer + 5 for giving feedback
  expect(await balance(korean)).toBe(20);    // 10 for rating + 10 for five-star feedback
  await koreanContext.close();
  await learnerContext.close();
});
test('an unknown share code says so', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Lost', role: 'learner' });
  await page.goto('/c/ZZZZZZ');
  await expect(page.getByText('This challenge link is not valid.')).toBeVisible();
});
```

If the share panel has no `data-testid="share-code"`, add it to `SharePanel` (with a component test asserting it).

- [ ] **Step 2: Run.** Run: `npx playwright test tests/e2e/peer.spec.ts --project=phone`. Expected: PASS.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "test: peer loop end to end in two browsers"`

---

### Task 4: Video answer and expiry, end to end

**Files:**
- Create: `tests/e2e/video-and-expiry.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
import { expect, test } from '@playwright/test';
import { onboard, recordFor } from './helpers';

test('a learner answers a sample challenge with video', async ({ page }) => {
  await page.goto('/app');
  await onboard(page, { nickname: 'Video', role: 'learner' });
  await page.getByRole('link', { name: 'Challenges' }).click();
  await page.getByRole('region', { name: 'Open challenges' }).getByRole('link').first().click();
  await page.getByRole('radio', { name: 'Video' }).check();
  await recordFor(page, 2500);
  await expect(page.locator('video')).toBeVisible();
  const [upload] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/responses') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Send answer' }).click(),
  ]);
  expect(upload.status()).toBe(201);
  expect((await upload.json()).response.mediaKind).toBe('video');
});
test('the cleanup job refuses strangers and runs with the secret', async ({ request }) => {
  expect((await request.get('/api/cron/cleanup')).status()).toBe(401);
  const ok = await request.get('/api/cron/cleanup', { headers: { authorization: 'Bearer e2e-cron' } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ deleted: 0 });
});
```

- [ ] **Step 2: Run.** Expected: PASS. If the video upload is rejected as too large, lower the recorder's video bitrate (frontend plan task 3) with a unit test that pins the new value.
- [ ] **Step 3: Commit.** `git add tests/e2e && git commit -m "test: video answer and cleanup route end to end"`

---

### Task 5: Width and accessibility sweep

**Files:**
- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the sweep**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { onboard } from './helpers';

const PUBLIC = ['/', '/privacy', '/app/onboarding'];
const SIGNED_IN = ['/app', '/app/challenges', '/app/rewards', '/app/me'];
const WIDTHS = [320, 390, 768, 1440];

const check = async (page: import('@playwright/test').Page, path: string) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${path}: ${v.id}`)).toEqual([]);
};

test.describe('desktop project only', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'the sweep sets its own widths');
  for (const path of PUBLIC) test(`public ${path}`, async ({ page }) => { await check(page, path); });
  test('signed-in screens, a mission, and a challenge', async ({ page }) => {
    await page.goto('/app');
    await onboard(page, { nickname: 'Sweep', role: 'learner' });
    for (const path of SIGNED_IN) await check(page, path);
    await page.goto('/app');
    await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().click();
    await check(page, new URL(page.url()).pathname);
    await page.goto('/app/challenges');
    await page.getByRole('region', { name: 'Open challenges' }).getByRole('link').first().click();
    await check(page, new URL(page.url()).pathname);
  });
  test('the whole solo loop works from the keyboard', async ({ page }) => {
    await page.goto('/app');
    await onboard(page, { nickname: 'Keys', role: 'learner' });
    await page.getByRole('region', { name: "Today's missions" }).getByRole('link').first().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Record' }).focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Stop' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Get my score' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('meter', { name: 'Pronunciation' })).toBeVisible({ timeout: 20_000 });
  });
});
```

- [ ] **Step 2: Run and fix.** Run: `npx playwright test tests/e2e/a11y.spec.ts --project=desktop`. Expected: PASS. Fix each violation in the component that owns it, with a component test where one can express the rule (label, role, name), then rerun.
- [ ] **Step 3: Check reduced motion and zoom by hand.** With "reduce motion" emulated, nothing travels. At 200% browser zoom on the mission screen, text reflows and nothing is clipped. Record both results in the handoff.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "test: width and accessibility sweep"`

---

### Task 6: Secrets, headers, and bundle check

**Files:**
- Create: `tests/e2e/security.spec.ts`, `scripts/check-bundle.mjs`
- Modify: `next.config.ts` (response headers), `package.json` (script `check:bundle`)

- [ ] **Step 1: Write the header test**

```ts
import { expect, test } from '@playwright/test';

test('pages carry the security headers', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['permissions-policy']).toBe('microphone=(self), camera=(self), geolocation=()');
});
test('the session cookie is locked down', async ({ request }) => {
  const res = await request.post('/api/session', { data: { nickname: 'Cookie', role: 'learner', consent: true } });
  const cookie = res.headers()['set-cookie'];
  for (const part of ['hl_session=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) expect(cookie).toContain(part);
});
test('a write from another origin is refused', async ({ request }) => {
  const res = await request.post('/api/session', { headers: { origin: 'https://evil.example' }, data: { nickname: 'Evil', role: 'learner', consent: true } });
  expect(res.status()).toBe(403);
});
```

- [ ] **Step 2: Run to verify the header test fails**, then add the four headers for all routes in `next.config.ts` (read the bundled Next.js docs for the `headers` option first) and rerun. Expected: PASS.

- [ ] **Step 3: Write `scripts/check-bundle.mjs`**

After a build, it reads every file under `.next/static` and fails (exit 1, printing file and match) if any contains: `api.openai.com`, `chat/completions`, `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `pg_advisory`, or a string matching `sk-[A-Za-z0-9_-]{20,}`. It also runs `git ls-files` and fails if `.env.local`, anything under `.data/`, or any file containing a match for `sk-[A-Za-z0-9_-]{20,}` is tracked.

- [ ] **Step 4: Run.** Run: `npm run build && npm run check:bundle`. Expected: `bundle clean, repository clean`. A hit means server code is imported into a client component: find the import and move it behind the API.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "test: security headers and client bundle check"`

---

### Task 7: Provision Supabase and migrate

Needs owner checkpoint H2. If an agent skill for Supabase or Vercel is available in your session, load it and follow it; the steps below are the required outcome either way.

- [ ] **Step 1: If plan 03 task 15 step 3 did not run, run it now** against a throwaway Docker Postgres. Expected: both live tests pass.

- [ ] **Step 2: Create the project**

A Supabase project in Seoul (`ap-northeast-2`). Record, outside the repository: the transaction pooler connection string (port 6543), the project URL, and the secret key (server-side key; never the publishable key).

- [ ] **Step 3: Create the private bucket**

Create a Storage bucket named `recordings` with public access off. Verify: an unauthenticated request for any object path in it is refused.

- [ ] **Step 4: Migrate**

Run, with the connection string supplied only in the environment of this one command: `npm run db:migrate`
Expected: prints `0001_init.sql`; running it again applies nothing.

- [ ] **Step 5: Verify what the database exposes**

In the Supabase SQL editor run:

```sql
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'hanlog' and c.relkind = 'r' order by 1;
select count(*) from hanlog.challenges where is_sample;
```

Expected: seven tables, row level security on for all but `schema_migrations`; the sample count equals the number of entries in `content/sample-challenges.json`. Then confirm that schema `hanlog` is not listed among the Data API's exposed schemas in the project's API settings, and that a request to the project's REST endpoint for `users` with the publishable key returns nothing from `hanlog`.

- [ ] **Step 6: Record** the region, the bucket name, and the date in `docs/HANDOFF.md` (no keys, no connection string).

---

### Task 8: Deploy to Vercel and smoke test with real scoring

Needs owner checkpoints H1 and H2.

- [ ] **Step 1: Link the project and set production variables**

Set for Production (and Preview): `SESSION_SECRET` (a fresh random value of at least 48 characters), `CRON_SECRET` (a fresh random value), `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, plus whatever `docs/handoffs/scoring.md` says production needs (`SCORING_HEARD_FROM`, `SCORING_RUNS`). Do not set `SCORING_PROVIDER`. Generate the random values locally and paste them into Vercel; do not echo them into a file.

- [ ] **Step 2: Deploy a preview**

Expected: the build succeeds; the deployment's function region is Seoul; the cron appears in the project's cron list with schedule `0 18 * * *`.

- [ ] **Step 3: Smoke test the preview over HTTP**

Write `scripts/smoke.mjs` (takes the base URL as its argument, uses `fetch`, keeps its own cookie): `GET /api/session` returns `{ user: null }`; `POST /api/session` returns 201 with a cookie carrying `Secure`; `GET /api/missions` returns 24 missions; `POST /api/missions/cafe-iced-americano/attempts` with `tests/fixtures/scoring/native-cafe.wav` returns 200 with `score.scoredBy === 'ai'` and `overall >= 80`; the same route with a silent WAV returns 422 `no_speech`; `GET /api/points` shows a positive balance; `GET /api/cron/cleanup` without a token returns 401; `DELETE /api/session` returns 204. It prints one PASS or FAIL line per check and exits 1 on any failure.

Run: `node scripts/smoke.mjs https://<preview-address>`
Expected: all PASS. `scoredBy` being `mock` means `OPENAI_API_KEY` did not reach the deployment: fix the variable, redeploy, rerun.

- [ ] **Step 4: Exercise storage on the preview**

With two browser profiles on the preview address, run the peer loop once by hand (post, answer, play, rate). Expected: the answer plays for the rater; one object appears in the `recordings` bucket under `responses/`. Then delete the test learner with "Delete my data" and confirm the object is gone.

- [ ] **Step 5: Ask the owner, then promote to production**

Show the owner the preview address and the smoke output. After they approve, promote. Run `node scripts/smoke.mjs https://<production-address>` once.
Expected: all PASS.

- [ ] **Step 6: Commit.** `git add scripts/smoke.mjs && git commit -m "chore: deployment smoke script"`

---

### Task 9: Device checklist for the owner

**Files:**
- Create: `docs/device-check.md`

- [ ] **Step 1: Write the checklist (owner checkpoint H5)**

One table per device (iPhone Safari, Android Chrome), each row a step with a "works / does not" column and a notes column:
1. Open the production address. The first screen shows the heading and "Try a mission now" without scrolling.
2. Tick consent. The browser asks for the microphone once.
3. Say the café sentence. The timer and level meter move. Stop. The preview plays back your voice.
4. "Get my score" shows a score within about ten seconds, with feedback about your own pronunciation and no "Demo scoring" badge.
5. Say something else entirely. The score is below 50 and no points are given.
6. Stay silent. The message says it could not hear any Korean.
7. Open the app, finish onboarding, complete one mission from "Today's missions".
8. Switch to the home screen of the phone mid-recording and come back. The recording has stopped and the microphone indicator is off.
9. On a second device as a Korean speaker, post a challenge and send the link. Open it on the phone, answer with video, and have it rated. Both sides see the result and their points.
10. Turn the phone sideways and back. Nothing breaks.
11. "Delete my data" returns to the introduction page and the app asks to onboard again.

Add a place to write the phone model, the OS version, and the date.

- [ ] **Step 2: Commit.** `git add docs/device-check.md && git commit -m "docs: real-device checklist"`

---

### Task 10: Final handoff

**Files:**
- Create: `docs/HANDOFF.md`
- Modify: `README.md`, `.env.example`

- [ ] **Step 1: Write `README.md`**

What HanLog is in three sentences; how to run it locally (`npm install`, `npm run dev`, open `http://localhost:3000`, no configuration, mock scoring); how to run with real scoring (`OPENAI_API_KEY` in `.env.local`); the commands (`check`, `test:e2e`, `eval:scoring`, `db:migrate`, `content:audio`, `check:bundle`); where the spec and plans are.

- [ ] **Step 2: Write `docs/HANDOFF.md`**

For a person who was not here: what exists and where it runs; what is real (list) and what is display only or mocked (rewards shop, sample challenges authored by the system user, mock scoring without a key); the measured scoring results and known weaknesses, copied from `docs/spike/`; current caps and how to change them; what the owner still owes (H3 content review, H4 samples, H5 device check, H6 operator name) with their state; every deviation from the spec found during integration; the five most useful next steps in priority order.

- [ ] **Step 3: Final verification**

Run: `npm run check && npm run test:e2e && npm run build && npm run check:bundle`
Expected: all PASS.

- [ ] **Step 4: Commit and tag**

```bash
git add -A && git commit -m "docs: README and project handoff" && git tag v0.1.0
```
