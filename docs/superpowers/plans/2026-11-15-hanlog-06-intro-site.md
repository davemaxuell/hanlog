# HanLog Introduction Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public page at `/` that explains HanLog to a learner in under a minute and lets them record one sentence and get a real score without leaving the page, plus the privacy page.

**Architecture:** A server-rendered page assembled from small section components in `src/components/intro`. One client component, `TryNow`, gates on consent, creates a guest session if there is none, and renders the same `MissionFlow` the app uses. Nothing here duplicates recorder or scoring code.

**Tech Stack:** Next.js 16 App Router (server components plus one client island), Tailwind CSS 4 tokens, Vitest with jsdom.

**Spec:** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, sections 1, 2, 4.1, 12, 13, 14. Design direction: `docs/design/open-window/DESIGN.md` and `reference.html` beside it. Orchestration: `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`.

**Starts after:** frontend plan tasks 1 to 5 and task 8 (`MissionFlow`) are merged to `main`.

## Global Constraints

- Section order, headings, and the quoted sentences are exactly as spec section 4.1.
- Claims the page must never make: that the score is official or related to any exam; that any brand, shop, label, or sponsor is a partner; that an app is available in a store; that coupons can be redeemed today.
- The rewards section always carries the sentence `Example rewards. Partners are not confirmed yet.`
- The consent sentence is exactly the one in spec section 12, and recording is impossible before it is ticked.
- Reuse `MissionFlow`, `Recorder`, `ScoreCard`, and the UI primitives. Do not copy them.
- Phone first at 390 px; no horizontal scrolling at 320 px; at most one corner mark per screenful; one primary action per section.
- No images that need a license. Decoration is drawn with the design's own frames, margin, and corner mark. No stock photos, no emoji as icons.
- Edit only: `src/app/page.tsx`, `src/app/privacy/**`, `src/components/intro/**`, `src/app/icon.svg`, `src/app/opengraph-image.*`, `tests/ui/intro/**`, `docs/handoffs/intro.md`.

## Review Focus

1. A visitor who already has a session (came back from the app) must not get a second guest account. Pinned in task 2.
2. Consent unticked: no microphone request, no session, no network call. Pinned in task 2.
3. The address has hit its new-user cap (a classroom): the panel must say why and still let the visitor read on. Pinned in task 2.
4. JavaScript still loading or failed: every section except the live panel must be readable. Pinned in task 3 (server-rendered content).
5. A forbidden claim slipping into the copy during later edits. Pinned in task 1 with a text scan that stays in the suite.

---

### Task 1: Section components

**Files:**
- Create: `src/components/intro/{IntroHeader,Hero,Why,HowItWorks,PeerExchange,RewardsPreview,Questions,IntroFooter}.tsx`
- Test: `tests/ui/intro/sections.test.tsx`

**Interfaces:**
- Consumes: UI primitives from `@/components/ui`; `getRewards` from `@/lib/content`.
- Produces: one component per section, no props except `RewardsPreview(props: { rewards: Reward[] })`. None of them is a client component.

Copy that is fixed (everything else is yours to write, in the tone of spec section 13):

| Section | Fixed text |
|---|---|
| Header | Wordmark `HanLog` with `한로그`; link `Open the app` to `/app` |
| Hero | Heading `Speak Korean out in the world. Get a score that actually helps.`; line `Real expressions, your real voice, feedback in seconds, and points you can spend.`; link `Try a mission now` to `#try`; link `How it works` to `#how` |
| Why | Heading `Why it's hard to get better`; three items headed `Koreans switch to English`, `Textbook Korean isn't street Korean`, `Nobody tells you how you really sound` |
| How it works | Heading `How it works` (id `how`); steps numbered `01`, `02`, `03` headed `Get today's expression`, `Say it for real`, `Get your score and your points` |
| Peer exchange | Heading `Trade expressions with Korean friends`; body explains: a Korean speaker posts slang, you answer with your voice, you rate each other |
| Rewards | Heading `Points you can spend`; one card per reward with title and cost; `Example rewards. Partners are not confirmed yet.` |
| Questions | Heading `Questions`; four questions: `Is the score official?`, `What happens to my recording?`, `Does it cost anything?`, `Which browsers work?` |
| Footer | Wordmark; `Concept demo · 2026`; link `Privacy` to `/privacy` |

Fixed answers: official: `No. It is practice feedback from an AI model, not an exam result.` Recording: `A practice recording is sent to OpenAI to be scored and is not saved. A recording you send to another person is stored for up to 14 days so they can rate it, then deleted.` followed by a link `Read the privacy notice` to `/privacy`. Cost: `No. This is a concept demo.` Browsers: `Recent Chrome, Safari, Edge, and Firefox on phone or computer. You need a microphone.`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Hero, HowItWorks, IntroFooter, IntroHeader, PeerExchange, Questions, RewardsPreview, Why } from '@/components/intro';
import { getRewards } from '@/lib/content';

const all = () => render(<><IntroHeader /><Hero /><Why /><HowItWorks /><PeerExchange /><RewardsPreview rewards={getRewards()} /><Questions /><IntroFooter /></>);

it('says what HanLog is and where to start', () => {
  all();
  expect(screen.getByRole('heading', { level: 1, name: 'Speak Korean out in the world. Get a score that actually helps.' })).toBeInTheDocument();
  expect(screen.getByText('Real expressions, your real voice, feedback in seconds, and points you can spend.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Try a mission now' })).toHaveAttribute('href', '#try');
  expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#how');
  expect(screen.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', '/app');
  expect(screen.getAllByText('한로그')[0]).toHaveAttribute('lang', 'ko');
});
it('has the sections in the spec, each with its heading', () => {
  all();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(
    ["Why it's hard to get better", 'How it works', 'Trade expressions with Korean friends', 'Points you can spend', 'Questions']);
  const how = within(screen.getByRole('heading', { name: 'How it works' }).closest('section')!);
  expect(how.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(["Get today's expression", 'Say it for real', 'Get your score and your points']);
  expect(screen.getByRole('heading', { name: 'How it works' }).closest('section')).toHaveAttribute('id', 'how');
});
it('shows every example reward with the disclaimer', () => {
  all();
  for (const reward of getRewards()) expect(screen.getByText(reward.title)).toBeInTheDocument();
  expect(screen.getByText('Example rewards. Partners are not confirmed yet.')).toBeInTheDocument();
});
it('answers the four questions honestly', () => {
  all();
  expect(screen.getByText('No. It is practice feedback from an AI model, not an exam result.')).toBeInTheDocument();
  expect(screen.getByText(/is sent to OpenAI to be scored and is not saved/)).toBeInTheDocument();
  expect(screen.getByText(/stored for up to 14 days/)).toBeInTheDocument();
  expect(screen.getByText('No. This is a concept demo.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Read the privacy notice' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByText('Concept demo · 2026')).toBeInTheDocument();
});
it('makes none of the forbidden claims', () => {
  const { container } = all();
  const text = container.textContent ?? '';
  for (const forbidden of [/official score/i, /TOPIK/i, /certified/i, /partner(ed|ship)? with/i, /sponsored by/i, /app store/i, /google play/i, /download the app/i, /redeem now/i, /guarantee/i])
    expect(text).not.toMatch(forbidden);
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/ui/intro`. Expected: FAIL.
- [ ] **Step 3: Implement.** Export everything from `src/components/intro/index.ts`. Layout notes: the hero title uses the title font at 30 to 34 px on phones and may grow to 48 px on wide screens; "How it works" uses `MarginRow` with the step number in the margin; "Why" is three short entries on the canvas with open space, not three boxed cards; the peer section shows a small static illustration built from the design's frames (a challenge card and a rating row) with `aria-hidden`; reward cards show a category label, title, and cost, no buttons. The single corner mark goes on the hero.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/components/intro tests/ui/intro && git commit -m "feat: introduction page sections"`

---

### Task 2: Live try panel

**Files:**
- Create: `src/components/intro/TryNow.tsx`
- Test: `tests/ui/intro/try-now.test.tsx`

**Interfaces:**
- Consumes: `MissionFlow` and its props (frontend plan task 8), `api`, `errorCopy`, `Mission`, `RecorderDeps`.
- Produces: `TryNow(props: { mission: Mission; convert?: (blob: Blob) => Promise<Uint8Array>; deps?: Partial<RecorderDeps> })`, a client component inside a section with id `try` and heading `Try it now`.

Behavior:
1. Before consent: the mission's Korean sentence and meaning are visible, the consent checkbox with the exact sentence from spec section 12 and a link to `/privacy`, and a line `Tick the box to turn on the recorder.` No recorder, no session call.
2. On ticking: call `api.getSession()`. If it returns a user, use it. If not, call `api.createSession({ nickname: 'Guest ' + four random digits, role: 'learner' })`.
3. Then render `MissionFlow` for the mission. When a score arrives, show a link `Keep going in the app` to `/app` under the score card.
4. If the session call fails, show `errorCopy(code)` and a `Try again` button; the rest of the page stays usable.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('../_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('../_helpers')).mockApi }));

import { TryNow } from '@/components/intro/TryNow';
import { ApiClientError } from '@/lib/api-client';
import { samples } from '../../fixtures/api/samples';
import { toneWav } from '../../helpers/audio';
import { fakeDeps } from '../_fakes';
import { mockApi, resetMocks } from '../_helpers';

beforeEach(resetMocks);
const mission = samples.missions.find((m) => m.id === 'cafe-iced-americano')!;
const consent = () => screen.getByRole('checkbox', { name: /I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days\. I am 14 or older\./ });
const mount = (deps = fakeDeps()) => { render(<TryNow mission={mission} convert={async () => toneWav(1000)} deps={deps} />); return deps; };

it('does nothing until consent is given', () => {
  const deps = mount();
  expect(screen.getByRole('heading', { name: 'Try it now' })).toBeInTheDocument();
  expect(screen.getByText(mission.korean)).toHaveAttribute('lang', 'ko');
  expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
  expect(mockApi.getSession).not.toHaveBeenCalled();
  expect(mockApi.createSession).not.toHaveBeenCalled();
  expect(deps.streams).toHaveLength(0);
});
it('creates a guest learner on consent and then scores for real', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  mockApi.submitAttempt.mockResolvedValue(samples.attemptResult);
  const deps = mount();
  await userEvent.click(consent());
  await waitFor(() => expect(mockApi.createSession).toHaveBeenCalledTimes(1));
  expect(mockApi.createSession.mock.calls[0][0]).toEqual({ nickname: expect.stringMatching(/^Guest \d{4}$/), role: 'learner' });
  await userEvent.click(await screen.findByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
  expect(await screen.findByRole('meter', { name: 'Pronunciation' })).toBeInTheDocument();
  expect(mockApi.submitAttempt).toHaveBeenCalledWith('cafe-iced-americano', expect.any(Uint8Array));
  expect(screen.getByRole('link', { name: 'Keep going in the app' })).toHaveAttribute('href', '/app');
});
it('reuses an existing session instead of creating a guest', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mount();
  await userEvent.click(consent());
  expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
  expect(mockApi.createSession).not.toHaveBeenCalled();
});
it('explains a refused session and lets the visitor retry', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockRejectedValueOnce(new ApiClientError('daily_limit', 429, 'x')).mockResolvedValueOnce(samples.user);
  mount();
  await userEvent.click(consent());
  expect(await screen.findByRole('alert')).toHaveTextContent("You've reached today's practice limit. Come back tomorrow!");
  expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
});
it('does not create two guests when the box is toggled quickly', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  mount();
  await userEvent.click(consent());
  await userEvent.click(consent());
  await userEvent.click(consent());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument());
  expect(mockApi.createSession).toHaveBeenCalledTimes(1);
});
```

`samples.missions` must include `cafe-iced-americano`; adapt the `ApiClientError` constructor call to the class as written.

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** the behavior above. Unticking after a session exists hides the recorder again but does not delete the session.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/components/intro/TryNow.tsx tests/ui/intro/try-now.test.tsx && git commit -m "feat: live try panel with consent and guest session"`

---

### Task 3: Assemble the page

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/ui/intro/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('../_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('../_helpers')).mockApi }));

import IntroPage, { metadata } from '@/app/page';

it('lays the sections out in the spec order with the live panel third', () => {
  render(<IntroPage />);
  const order = [...document.querySelectorAll('header, main > section, footer')].map((el) => el.getAttribute('data-section'));
  expect(order).toEqual(['header', 'hero', 'try', 'why', 'how', 'peer', 'rewards', 'questions', 'footer']);
  expect(document.getElementById('try')).not.toBeNull();
  expect(document.getElementById('how')).not.toBeNull();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByText('아이스 아메리카노 한 잔 주세요.')).toBeInTheDocument();
});
it('describes itself for links and search', () => {
  expect(metadata.title).toBe('HanLog · Speak Korean out in the world');
  expect(String(metadata.description)).toContain('Real expressions, your real voice');
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** The page is a server component: it reads the mission with `getMission('cafe-iced-americano')` and the rewards with `getRewards()` and passes them down. Each top-level block carries its `data-section` name. Add a skip link to `#try` as the first focusable element. Content width up to 1120 px; prose lines 60 to 68 characters.
- [ ] **Step 4: Run to verify it passes, then build.** Run: `npx vitest run tests/ui/intro && npm run build`. Expected: PASS; `/` is prerendered as static content.
- [ ] **Step 5: Commit.** `git add src/app/page.tsx tests/ui/intro/page.test.tsx && git commit -m "feat: assemble the introduction page"`

---

### Task 4: Privacy page

**Files:**
- Create: `src/app/privacy/page.tsx`
- Test: `tests/ui/intro/privacy.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Privacy from '@/app/privacy/page';

it('says what is collected, where it goes, how long it stays, and how to delete it', () => {
  const { container } = render(<Privacy />);
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy notice' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Who runs this', 'What we collect', 'Where it goes', 'How long we keep it', 'How to delete it', 'Age']);
  const text = container.textContent ?? '';
  for (const fact of ['nickname', 'OpenAI', 'Supabase', 'Vercel', '14 days', 'Delete my data', '14 or older', 'not saved'])
    expect(text).toContain(fact);
  expect(screen.getByRole('link', { name: "OpenAI's privacy policy" }).getAttribute('href')).toMatch(/^https:\/\/openai\.com\//);
  expect(screen.getByRole('link', { name: 'Back to HanLog' })).toHaveAttribute('href', '/');
  expect(text).not.toMatch(/we never|100% secure|guarantee/i);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** from spec section 12, in plain sentences a learner at intermediate English can read. "Who runs this" reads `HanLog is a concept demo run by the HanLog demo team.` until the owner supplies a name (checkpoint H6); record that placeholder in your handoff. "What we collect": nickname, role, a scrambled form of the network address used only to limit abuse, scores and points, and recordings as described. "Where it goes": hosting on Vercel, database and stored recordings on Supabase, scoring and text checks by OpenAI. Open the OpenAI link you use and confirm it loads before committing. Make no statement about what OpenAI does with data beyond the link.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add src/app/privacy tests/ui/intro/privacy.test.tsx && git commit -m "feat: privacy notice"`

---

### Task 5: Icon, share image, look, and handoff

**Files:**
- Create: `src/app/icon.svg`, `src/app/opengraph-image.tsx`, `docs/handoffs/intro.md`

- [ ] **Step 1: Icon and share image**

`icon.svg`: a 32 px square in the `action` color with a small window shape (four panes) in the `surface` color. `opengraph-image.tsx`: 1200 by 630, canvas background, the hero heading in the title font, the wordmark, nothing else. Read the metadata file conventions in the Next.js docs bundled under `node_modules/next/dist/docs/` before writing it. Take colors from `docs/design/open-window/tokens.json`.

- [ ] **Step 2: Verify**

Run: `npm run check && npm run build`
Expected: PASS; the build lists `/`, `/privacy`, `/icon.svg`, `/opengraph-image`.

- [ ] **Step 3: Look at it**

Run `npm run dev`. At 390, 320, 768, and 1440 px: no horizontal scrolling; the hero heading, the supporting line, and "Try a mission now" are visible without scrolling at 390 by 844; tick consent, record, and get the mock score with the "Demo scoring, not AI" badge; tab through the whole page and see the focus ring on every link, the checkbox, and the buttons; turn on reduced motion and confirm nothing slides.

Check the page against "Review before implementation" in `docs/design/open-window/DESIGN.md`: with the accent colors removed, the margin, title hierarchy, and frames should still make it recognizable.

- [ ] **Step 4: Write `docs/handoffs/intro.md` and commit**

What you verified and at which widths; copy you wrote beyond the fixed text; the operator-name placeholder; requests to other workstreams.

```bash
git add -A && git commit -m "feat: icon, share image, and intro handoff"
```
