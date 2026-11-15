# HanLog Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twenty-four missions, eight sample challenges, and a reference clip per mission, all of a quality a Korean university student would call natural.

**Architecture:** Content is plain JSON in `content/`, validated at load by the foundation's schemas and by a stricter rule test owned by this plan. Reference clips are generated once by a script, verified by transcribing them back, and committed as static files.

**Tech Stack:** JSON, Vitest, one `tsx` script calling OpenAI text-to-speech and transcription with `fetch`.

**Spec:** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, sections 1, 5.1, and 13. Orchestration: `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`.

## Global Constraints

- Keep the six seed missions, the two seed sample challenges, and the six rewards exactly as they are: other tests depend on their ids and values.
- Counts: 24 missions; level 1 has 12, level 2 has 8, level 3 has 4; at least 6 have mode `use`. 8 sample challenges.
- `korean` contains no digits and no Latin letters. Numbers are spelled in Hangul.
- `repeat` sentences have 4 to 25 Hangul syllables.
- A `use` keyword is a fixed-form word of 1 to 6 syllables that does not conjugate, and it appears in the example sentence.
- Romanization is Revised Romanization, lowercase.
- No brand, company, celebrity, or group names anywhere.
- `basePoints` equals `level * 10`.
- Edit only: `content/**`, `public/audio/missions/**`, `scripts/gen-reference-audio.ts`, `tests/unit/content/**`, `docs/content-review.md`, `docs/handoffs/content.md`.

## Review Focus

1. A sentence that is grammatical but that nobody says (textbook stiffness). Pinned by the review sheet in task 5 and owner checkpoint H3.
2. A `use` keyword that changes form in real sentences, so the substring check fails for a correct answer. Pinned in task 1 (keyword must appear verbatim) and by the choice rule in task 2.
3. A reference clip in which the synthetic voice says something other than the text. Pinned in task 4 by transcribing each clip back.
4. Slang that is dated or carries a meaning the learner would not want. Pinned by the review sheet.
5. Two missions that are near-duplicates. Pinned in task 1.

---

### Task 1: Rule tests for content

**Files:**
- Test: `tests/unit/content/rules.test.ts`

- [ ] **Step 1: Write the test (most of it fails until tasks 2 and 3)**

```ts
import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { SHARE_CODE_ALPHABET } from '@/lib/contracts';
import { getMissions, getRewards, getSampleChallenges } from '@/lib/content';
import { jamoSimilarity, normalizeHangul } from '@/lib/scoring/jamo';

const missions = getMissions();
const syllables = (s: string) => [...normalizeHangul(s)].length;
const TAGS = ['cafe', 'store', 'food', 'campus', 'transit', 'shopping', 'friends', 'fandom', 'slang', 'housing'];
const BANNED = /\bBTS\b|방탄|블랙핑크|스타벅스|삼성|카카오|네이버|쿠팡|배민|SM엔터|하이브|\bTOPIK\b|토픽/i; // a tripwire, not a full list: the human review is the real check

it('has the planned shape', () => {
  expect(missions).toHaveLength(24);
  expect([1, 2, 3].map((l) => missions.filter((m) => m.level === l).length)).toEqual([12, 8, 4]);
  expect(missions.filter((m) => m.mode === 'use').length).toBeGreaterThanOrEqual(6);
  expect(new Set(missions.map((m) => m.id)).size).toBe(24);
});
it('keeps the seed missions untouched', () => {
  const seed = (id: string) => missions.find((m) => m.id === id)!;
  expect(seed('cafe-iced-americano')).toMatchObject({ korean: '아이스 아메리카노 한 잔 주세요.', level: 1, mode: 'repeat' });
  expect(seed('greet-nice-to-meet').korean).toBe('만나서 반갑습니다.');
  expect(seed('store-no-receipt').korean).toBe('영수증은 버려 주세요.');
  expect(seed('transit-this-stop').korean).toBe('이번 역에서 내려요.');
  expect(seed('slang-daebak')).toMatchObject({ mode: 'use', keyword: '대박' });
  expect(seed('campus-group-roles').korean).toBe('조별 과제 역할을 어떻게 나눌까요?');
});
it.each(missions)('$id follows the writing rules', (m) => {
  expect(m.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  expect(m.korean).not.toMatch(/[0-9A-Za-z]/);
  expect(m.romanization).toMatch(/^[a-z ,.'?!-]+$/);
  expect(m.basePoints).toBe(m.level * 10);
  expect(m.tags.length).toBeGreaterThan(0);
  expect(m.tags.every((t) => TAGS.includes(t))).toBe(true);
  for (const text of [m.korean, m.meaningEn, m.situationEn, m.promptEn]) expect(text).not.toMatch(BANNED);
  expect(m.meaningEn.length).toBeGreaterThan(0);
  expect(m.meaningEn.length).toBeLessThanOrEqual(120);
  expect(m.situationEn.length).toBeGreaterThan(0);
  expect(m.situationEn.length).toBeLessThanOrEqual(160);
  expect(m.promptEn.length).toBeLessThanOrEqual(120);
  if (m.mode === 'repeat') {
    expect(syllables(m.korean)).toBeGreaterThanOrEqual(4);
    expect(syllables(m.korean)).toBeLessThanOrEqual(25);
  } else {
    expect(syllables(m.keyword!)).toBeGreaterThanOrEqual(1);
    expect(syllables(m.keyword!)).toBeLessThanOrEqual(6);
    expect(normalizeHangul(m.korean)).toContain(normalizeHangul(m.keyword!));
    expect(m.promptEn).toContain(m.keyword!);
  }
  if (m.referenceAudio !== null) {
    expect(m.referenceAudio).toBe(`/audio/missions/${m.id}.mp3`);
    expect(existsSync(`public${m.referenceAudio}`)).toBe(true);
  }
});
it('has no near-duplicate sentences and no repeated keywords', () => {
  for (let i = 0; i < missions.length; i++)
    for (let j = i + 1; j < missions.length; j++)
      expect(jamoSimilarity(missions[i].korean, missions[j].korean), `${missions[i].id} vs ${missions[j].id}`).toBeLessThan(0.8);
  const keywords = missions.filter((m) => m.keyword).map((m) => m.keyword);
  expect(new Set(keywords).size).toBe(keywords.length);
});
it('has eight sample challenges that follow the rules', () => {
  const samples = getSampleChallenges();
  expect(samples).toHaveLength(8);
  expect(samples.slice(0, 2).map((s) => s.code)).toEqual(['SMPL22', 'SMPL23']);
  expect(new Set(samples.map((s) => s.code)).size).toBe(8);
  for (const s of samples) {
    expect(s.code).toHaveLength(6);
    expect([...s.code].every((ch) => SHARE_CODE_ALPHABET.includes(ch))).toBe(true);
    expect(syllables(s.korean)).toBeGreaterThan(0);
    expect([...s.korean].length).toBeLessThanOrEqual(60);
    expect(s.meaningEn.length).toBeGreaterThan(0);
    expect(s.meaningEn.length).toBeLessThanOrEqual(120);
    expect(s.situationEn.length).toBeLessThanOrEqual(200);
    for (const text of [s.korean, s.meaningEn, s.situationEn]) expect(text).not.toMatch(BANNED);
  }
});
it('leaves the rewards catalog alone', () => {
  expect(getRewards().map((r) => [r.id, r.cost])).toEqual([['kpop-album', 3000], ['kpop-photocard', 1200], ['grocery-10000', 1000], ['fashion-10', 800], ['cvs-5000', 500], ['cafe-drink', 400]]);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/unit/content`
Expected: the seed, per-mission, and rewards tests pass; "has the planned shape" and the sample challenge count fail (6 missions, 2 samples so far).

- [ ] **Step 3: Commit.** `git add tests/unit/content && git commit -m "test: content rules"`

---

### Task 2: Write the missions

**Files:**
- Modify: `content/missions.json`

- [ ] **Step 1: Add 18 missions to reach this coverage**

Keep the six seeds. The file order within a level is the order learners see, easiest first.

| Level | Count | Mode | Must cover (one mission each unless a number is given) |
|---|---|---|---|
| 1 | 10 `repeat` (2 are seeds) | repeat | thanking someone warmly; apologizing for bumping into someone; asking where the restroom is; asking the price; paying by card at a convenience store; asking for water at a restaurant; asking someone to say it again slowly; saying where you are from (Indonesia is fine; do not name a university) |
| 1 | 2 `use` | use | one everyday intensifier (for example 진짜); one cheer word (for example 화이팅) |
| 2 | 5 `repeat` (2 are seeds) | repeat | ordering food less spicy; asking a classmate to share notes; asking to exchange an item for another size |
| 2 | 3 `use` (1 is a seed) | use | one softener used when asking a favor (for example 혹시); one reaction word friends use (not 대박) |
| 3 | 3 `repeat` (1 is a seed) | repeat | asking a professor politely for a deadline extension; one sentence for a part-time job interview |
| 3 | 1 `use` | use | one current noun-form slang a student would use about study or daily life, not already in the sample challenges |

Writing rules beyond the Global Constraints:
- Level 2 `repeat` sentences should each contain at least two final consonants and one place where linking (연음) changes the sound, because that is the persona's stated difficulty.
- `situationEn` names a real place and moment ("At the campus cafeteria, when the server asks how spicy").
- `promptEn` for `repeat` says who to say it to. For `use` it reads "Make your own sentence with {keyword} about ..." and includes the keyword in Hangul.
- For a `use` keyword, check at least three natural sentences in your head: if the word ever appears with a different ending, pick another word.
- Leave `referenceAudio` as `null`; task 4 fills it.

- [ ] **Step 2: Run the rules**

Run: `npx vitest run tests/unit/content && npm run check`
Expected: every mission test passes; only the sample challenge count still fails. The foundation's `tests/unit/content.test.ts` still passes.

- [ ] **Step 3: Commit.** `git add content/missions.json && git commit -m "content: twenty-four missions"`

---

### Task 3: Write the sample challenges

**Files:**
- Modify: `content/sample-challenges.json`

- [ ] **Step 1: Add 6 sample challenges**

Keep `SMPL22` and `SMPL23`. New codes are `SMPL24` to `SMPL29`. Each is a slang or casual expression a Korean student would teach a foreign friend: `korean` is a full natural sentence using it; `meaningEn` explains the expression itself, including what it abbreviates if it is an abbreviation; `situationEn` says when you would say it and to whom. Choose expressions that are friendly and safe to repeat to anyone: nothing sexual, insulting, political, or about appearance. Do not reuse a keyword from the missions.

- [ ] **Step 2: Run everything**

Run: `npm run check`
Expected: PASS. If a backend test counted sample challenges with a literal number, that is a defect in that test: note it in your handoff, do not change your count.

- [ ] **Step 3: Commit.** `git add content/sample-challenges.json && git commit -m "content: eight sample challenges"`

---

### Task 4: Reference clips

Needs `OPENAI_API_KEY` (owner checkpoint H1). Without it, skip this task, leave every `referenceAudio` as `null` (the interface hides the Listen button), and say so in the handoff.

**Files:**
- Create: `scripts/gen-reference-audio.ts`, `public/audio/missions/*.mp3`
- Modify: `content/missions.json` (`referenceAudio` fields)

**Interfaces:**
- Produces: `npm run content:audio` with flags `--force` (regenerate existing files) and `--only <id>`.

- [ ] **Step 1: Write the script**

For each mission whose clip is missing:
1. `POST https://api.openai.com/v1/audio/speech` with `{ model: 'gpt-4o-mini-tts', voice: 'marin', input: mission.korean, instructions: 'Speak clear, natural Seoul Korean at a calm everyday pace, like a friendly university student.', response_format: 'mp3' }`. Save to `public/audio/missions/<id>.mp3`.
2. Verify by transcribing the clip back: `POST https://api.openai.com/v1/audio/transcriptions` (multipart: the file and `model: 'gpt-transcribe'`; read the current speech-to-text guide for the language hint field and set Korean). Require `jamoSimilarity(transcript, mission.korean) >= 0.9`. On failure, regenerate once with voice `cedar`; if it fails again, delete the file and report the id.
3. Set `referenceAudio` to `/audio/missions/<id>.mp3` for verified clips and rewrite `content/missions.json` with two-space indentation, preserving order.

Print one line per mission: id, bytes, similarity, PASS or FAIL. Exit 1 if any failed.

This text-to-speech model shuts down on 2027-01-06. The clips are static files, so nothing breaks then; the script simply stops being rerunnable and a note at the top of the file must say so.

- [ ] **Step 2: Run it**

Run: `npm run content:audio`
Expected: 24 PASS lines, 24 files, each larger than 5 KB.

- [ ] **Step 3: Run the rules again**

Run: `npm run check`
Expected: PASS, including the check that every non-null `referenceAudio` file exists.

- [ ] **Step 4: Commit.** `git add scripts/gen-reference-audio.ts public/audio content/missions.json && git commit -m "content: verified reference clips for every mission"`

---

### Task 5: Review sheet and handoff

**Files:**
- Create: `docs/content-review.md`, `docs/handoffs/content.md`

- [ ] **Step 1: Write `docs/content-review.md` for the native-speaker review (owner checkpoint H3)**

A short instruction in Korean and English ("Mark anything you would not say, or would say differently, and write the fix"), then one table for missions (id, level, mode, Korean, keyword, meaning, situation, OK or fix) and one for sample challenges (code, Korean, meaning, situation, OK or fix). Put the items you are least sure about at the top of each table.

- [ ] **Step 2: Write `docs/handoffs/content.md`**

Counts by level and mode; which task 4 clips failed, if any; the items you flagged as uncertain and why; whether the review has happened yet.

- [ ] **Step 3: Commit.** `git add docs/content-review.md docs/handoffs/content.md && git commit -m "docs: content review sheet and handoff"`
