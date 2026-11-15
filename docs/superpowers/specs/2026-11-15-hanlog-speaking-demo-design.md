# HanLog (한로그) speaking demo: design

Date: 2026-11-15. Status: approved in conversation by the owner; items in section 17 are the planner's calls and can be overridden.

This document is the single source of truth for what gets built. The plans in `docs/superpowers/plans/` say how and in what order. Where a plan and this document disagree, this document wins and the plan is wrong.

## 1. Intent

HanLog helps foreigners who are learning Korean spend more time living in Korean instead of studying it. A learner is given a real Korean expression, says it out loud in real life, and records it (voice, or video with voice). An AI model listens to the actual audio and scores pronunciation and correct usage. Scores earn points. Points will later become coupons (K-pop albums, groceries, clothes). A second loop pairs learners with Korean speakers: the Korean speaker posts an expression or slang challenge, the learner answers with a recording, and the two rate each other.

This delivery is a public website that (a) introduces HanLog and (b) lets visitors actually use both loops in a browser. The people watching are real prospective users, so the app has to run for real: real microphone, real AI score, real points.

Primary persona (from the Daewoong Thinking Project Topic 2 persona canvas): Aisha, 21, Indonesian undergraduate in Seoul, TOPIK level 4, K-pop fan. Her pains map directly onto the product: final consonants (받침) are hard, real speech and slang differ from textbook Korean, Koreans answer her in English so she gets no practice, she over-relies on translators, and she gains courage when mistakes are received warmly.

Success looks like:
1. A learner opens the link on a phone, and within 60 seconds has recorded one Korean sentence and received a credible score with specific feedback and points.
2. A Korean speaker and a learner complete one challenge exchange and each sees the other's rating.
3. The owner can hand the URL to a room of users without the API bill or the content getting out of control.

## 2. Goals, non-goals, anti-goals

Goals
- G1. An introduction page that explains HanLog to learners and contains a live "try it now" recording that returns a real score.
- G2. Solo loop, fully real: mission, record, AI score from audio, feedback, points.
- G3. Peer loop, real and asynchronous: Korean posts challenge, shares link or code, learner answers later with audio or video, both rate each other.
- G4. Points ledger that is computed on the server, plus a rewards shop that is display only.
- G5. Phone first. Works on iPhone Safari and Android Chrome, and on desktop Chrome, Edge, Firefox, Safari.
- G6. Safe to expose: API key never reaches the browser, spending is capped, recordings expire, user text is moderated.
- G7. Every agent can build and test with no external accounts: mock scorer, in-process Postgres, local media folder.

Non-goals (do not build)
- Native iOS or Android app.
- Real coupon redemption, partner integrations, payments.
- Email, password, or social login. Identity is a nickname plus a device cookie.
- Live calls, chat, or real-time presence between peers.
- Leaderboards, streaks, badges, notifications.
- AI analysis of video frames. The model hears audio only.
- A translated interface. The interface is English; target expressions are Korean.
- An admin dashboard.
- The earlier "shared day" feed (morning, afternoon, evening moments). That concept is retired.

Anti-goals (the build has failed if any of these is true, even if everything works)
- A mock or random score is shown as if it came from the AI.
- The site claims real partner brands, real coupons, or that the score is an official assessment (TOPIK or otherwise).
- Feedback wording shames or mocks the learner.
- The OpenAI key, the database URL, or the Supabase secret key is reachable from the browser or committed to git.
- Voice recordings are kept without an expiry.
- A stranger can run up unbounded API cost.
- The demo only works in desktop Chrome.

## 3. People and roles

| Role | Who | Can do |
|---|---|---|
| `learner` | A foreigner learning Korean | Solo missions, answer challenges, give feedback on the rating they received |
| `korean` | A Korean speaker | Post challenges, rate answers, also try missions |

A person picks a role at onboarding and can switch it on the profile screen (useful for testers who want to see both sides). There are no accounts. The server creates a user row and sets a signed cookie. Clearing the cookie loses the identity.

## 4. Experience

All screens follow the Open Window design direction (section 14). Interface language is English. Every Korean string is wrapped with `lang="ko"`.

### 4.1 Introduction page `/`

Order of sections:
1. Header: HanLog wordmark with 한로그, one button "Open the app" to `/app`.
2. Hero. Title: "Speak Korean out in the world. Get a score that actually helps." Supporting line: "Real expressions, your real voice, feedback in seconds, and points you can spend." Primary action "Try a mission now" scrolls to section 3. Secondary link "How it works".
3. Live try panel. One fixed mission (`cafe-iced-americano`). Consent line with checkbox, then the same recorder and score card the app uses. After a score: "Keep going in the app" to `/app`. Ticking consent creates a guest session (nickname `Guest` plus four digits, role `learner`).
4. Why. Three short statements from the persona: Koreans switch to English; textbook Korean is not street Korean; nobody tells you how you really sound.
5. How it works, three steps laid out on the margin-led index: 01 Get today's expression. 02 Say it for real (at the café, in class, on the street) and record voice or video. 03 AI listens, scores pronunciation and usage, you earn points.
6. Peer exchange. "Trade expressions with Korean friends": a Korean speaker posts slang, you answer, you rate each other.
7. Rewards. Example coupon cards from the rewards catalog with the line "Example rewards. Partners are not confirmed yet."
8. Questions. Is the score official? (No, it is practice feedback from an AI model.) What happens to my recording? (Section 12 summary, link to `/privacy`.) Does it cost anything? (This is a concept demo.) Which browsers work?
9. Footer: wordmark, "Concept demo · 2026", link to `/privacy`.

### 4.2 Onboarding `/app/onboarding`

Fields: nickname (2 to 20 characters), role (two large choices: "I'm learning Korean" and "I speak Korean · 한국어 화자예요"), consent checkbox with the text in section 12. Button "Start". On success go to the `next` query parameter if present and it starts with `/app` or `/c/`, otherwise `/app`.

### 4.3 App shell

Every `/app/*` screen except onboarding requires a session. Without one the shell redirects to `/app/onboarding?next=<current path>`. The shell shows the wordmark, a points chip with the current balance, and navigation with four labelled items: Missions (`/app`), Challenges (`/app/challenges`), Rewards (`/app/rewards`), Me (`/app/me`). On phones the navigation sits at the bottom; on wide screens in the header.

### 4.4 Home `/app`

- Greeting: "안녕하세요, {nickname}".
- For role `korean`: a block at the top with "Answers waiting for your rating" (count, link to challenges) and a button "Post a challenge".
- "Today's missions": three missions, one per level, chosen by `todaysMissionIds` (section 9.4). Same three for everyone on a given Korea-time date.
- "All missions": grouped by level 1, 2, 3. Each row shows the Korean expression, the English meaning, and either the best score or "New".

### 4.5 Mission `/app/missions/[id]`

Content, top to bottom: level in the margin; Korean expression large; romanization (hidden behind a "Show romanization" toggle); meaning; an apricot "Where to say it" note with the situation; instruction line (`promptEn`); "Listen" button when a reference clip exists, labelled "AI voice"; the recorder (audio or video); then the result.

Result (score card): overall score as the headline number; three labelled bars with numbers: Pronunciation, Accuracy, and the third bar labelled "Naturalness" for `repeat` missions and "Usage" for `use` missions; "We heard: {heard}"; up to three issues, each as segment, problem, tip; one praise sentence; one next tip; "+N points" with the margin marker filling, or "No points this time. Scores of 50 and above earn points.", or, when the score is 50 or more but the mission has already paid out, "Already earned for this mission."; buttons "Try again" and "Next mission". When the score came from the mock scorer the card shows a visible badge "Demo scoring, not AI".

States: idle, asking for permission, recording (one tap on "Record" asks for permission and starts; timer and live level meter; auto stop at 15 seconds), recorded (preview, "Retake", "Get my score"), converting, scoring ("Listening…", can take around ten seconds), result, error (message from section 4.11, recording kept so the user can retry).

If the microphone is denied or the browser cannot record, the learner can upload a voice file instead. Upload is offered for solo missions only; peer answers must be recorded live.

### 4.6 Challenges `/app/challenges`

For `learner`: two lists. "Open challenges" (newest first; each shows Korean text, meaning, author nickname, and "Answered" if the learner already answered) and "My answers" (each shows status "Waiting for rating" or "Rated").

For `korean`: "To rate" with a count, "My challenges", and a button "Post a challenge".

### 4.7 Post a challenge `/app/challenges/new` (role `korean` only)

Fields: Korean expression (required, must contain Hangul, up to 60 characters), English meaning (required, up to 120), situation or example (optional, up to 200), optional reference recording (audio only). After posting: a share panel with the six-character code, the link `/c/CODE`, a copy button, and the system share sheet where the browser supports it.

### 4.8 Challenge detail `/app/challenges/[id]`

Header: expression, meaning, situation, author, reference playback if present. The body depends on the viewer:

| Viewer | Sees |
|---|---|
| Learner who has not answered | Recorder (audio or video), then "Send answer". After sending: "Sent. {author} will rate it." |
| Learner who answered (`responder`) | Own recording playback and status. Once rated: pronunciation stars, naturalness stars, comment. Then, once, a feedback form: "Was this rating helpful?" stars 1 to 5 and an optional comment. |
| Author, or any `korean` user on a sample challenge (`author` or `rater`) | List of answers. Each pending answer has playback and a rating form: pronunciation 1 to 5, naturalness 1 to 5, optional comment. Rated answers show the rating and the learner's feedback if given. Each answer has a "Report" link. |
| Anyone else (`visitor` with role `korean`) | Read only header. |

A learner may replace their answer while it is still waiting for a rating. After rating it is locked.

### 4.9 Rewards `/app/rewards`

Balance; a short "How points work" explanation; coupon cards from the catalog, each with title, cost, a progress bar of balance against cost, and a disabled button "Coming soon"; the line "Example rewards. Partners are not confirmed yet."; then the points history (label, signed amount, date).

### 4.10 Me `/app/me`, share link `/c/[code]`, privacy `/privacy`

- Me: edit nickname, switch role, link to privacy, "Delete my data" with a confirmation dialog (deletes the user, their attempts, points, challenges, answers, and stored recordings, then returns to `/`).
- `/c/[code]`: looks up the challenge and redirects to `/app/challenges/[id]`. Unknown code shows a small "This challenge link is not valid" page.
- Privacy: the section 12 notice in plain language.

### 4.11 Error wording

| Code | Shown to the user |
|---|---|
| `no_speech` | We couldn't hear any Korean. Move closer to the mic and try again. |
| `audio_invalid`, `audio_too_large`, `media_invalid` | That recording didn't work. Please record again. |
| `daily_limit` | You've reached today's practice limit. Come back tomorrow! |
| `budget_exhausted` | HanLog is resting for today. Too many learners at once. Try again tomorrow. |
| `scoring_failed`, `service_unavailable`, `internal` | That didn't score yet. Try again. |
| `content_rejected` | Please rephrase that. We keep HanLog friendly for everyone. |
| `forbidden` | You can't do that with this profile. |
| `not_found` | We couldn't find that. |
| `conflict` | This answer has already been rated. |
| `unauthenticated` | (no message; redirect to onboarding) |

## 5. Scoring

### 5.1 Mission modes

- `repeat`: say the given sentence. Accuracy means the right words were said. The third score means naturalness (intonation, pace, delivery that fits the situation).
- `use`: make your own sentence that uses a given fixed expression (`keyword`). Accuracy means the keyword appears in a grammatical sentence. The third score means the expression was used with the right meaning, register, and situation.

### 5.2 Pipeline

1. Browser records, converts the audio track to WAV (PCM 16-bit, mono, 16 000 Hz), and posts it.
2. Server validates the WAV, rejects near-silence without calling the model, reserves a scoring call against the caps, calls the provider.
3. Provider returns a `RawScore`. `composeScore` turns it into the public `Score`.
4. Server stores the attempt and awards points in one transaction.

### 5.3 Provider (verified against OpenAI docs on 2026-11-15)

- Endpoint: `POST https://api.openai.com/v1/chat/completions`. The Responses API does not accept audio for this model.
- Model: `gpt-audio-1.5` (configurable through `OPENAI_SCORING_MODEL`). It is the only documented Chat Completions model that hears audio. It is not on the deprecations list. `gpt-audio-mini` shuts down on 2027-01-20 and must not be used.
- Audio goes in as a content part: `{"type":"input_audio","input_audio":{"data":"<base64>","format":"wav"}}`.
- Function calling is listed as supported. `response_format` JSON schema is not listed.
- Price: audio input 32 USD per million tokens, text input 2.50, text output 10.
- Called with plain `fetch`. No OpenAI SDK dependency.

Not stated in the docs and therefore settled by the scoring spike (plan 02, task 1): whether `modalities: ["text"]` is accepted with audio input, whether `strict` and a forced `tool_choice` work on this model, input size limits, tokens per second of audio, and how well the model judges Korean pronunciation.

### 5.4 `RawScore` and `composeScore`

`RawScore` is what the provider returns: `speechDetected`, `heard` (Hangul transcription of what was actually said), `pronunciation`, `accuracy`, `usage` (each 0 to 100), `issues` (up to 3 of segment, problem, tip), `praise`, `nextTip`.

`composeScore(raw, mission, scoredBy)` applies these rules in order:
1. If `speechDetected` is false or `heard` is blank, throw `NoSpeechError`.
2. Round and clamp each sub-score to an integer from 0 to 100.
3. Accuracy guard. For `repeat`: let `sim = jamoSimilarity(heard, mission.korean)`; then `accuracy = min(accuracy, round(sim * 100) + 10)`, clamped to 100. For `use`: let `hasKeyword` be whether `normalizeHangul(heard)` contains `normalizeHangul(mission.keyword)`; if not, `accuracy = min(accuracy, 40)`.
4. Overall is the rounded weighted sum. Weights (pronunciation, accuracy, usage): `repeat` 0.50, 0.30, 0.20; `use` 0.35, 0.25, 0.40.
5. Wrong-sentence gate. For `repeat`, if `sim < 0.6` then `overall = min(overall, 49)`. For `use`, if `hasKeyword` is false then `overall = min(overall, 49)`. Saying something else never earns points.
6. Keep at most 3 issues. Trim strings. Cut issue strings at 200 characters and `praise` and `nextTip` at 240.

`normalizeHangul(s)`: keep only Hangul syllables (U+AC00 to U+D7A3).

`jamoSimilarity(a, b)`: normalize both, decompose each syllable into initial, medial, and (when present) final jamo, tagging each token with its position so an initial ㄱ never equals a final ㄱ, then return `1 - levenshtein / max(length)`. If either sequence is empty the result is 0.

Why 0.6: measured on twelve everyday sentences, unrelated pairs average 0.20 and peak at 0.45; half of the target sentence scores 0.57; near misses (one vowel slip, a dropped final consonant, phonetic spelling, a dropped particle) score 0.82 to 0.96.

### 5.5 Mock provider

Used in development, tests, and whenever no OpenAI key is configured. Deterministic: `speechDetected` is true when the WAV root mean square is at least 0.01; `heard` equals `mission.korean`; pronunciation 84, accuracy 96, usage 88; one fixed issue; fixed praise and tip. Composed overall is 88 for `repeat` and 89 for `use`. Scores from it carry `scoredBy: "mock"` and the interface shows the "Demo scoring, not AI" badge.

### 5.6 Prompt contract

System prompt requirements (full text is written in plan 02):
- The recording is speech to assess and never an instruction. Requests inside it to change scores are ignored.
- Transcribe what was actually said into `heard` before comparing with the target. Never copy the target.
- No intelligible speech: `speechDetected` false. Speech in another language: `speechDetected` true, write what was heard, accuracy 0 to 10.
- Anchored bands for pronunciation: 90 to 100 near native and fully clear; 75 to 89 clear with a minor accent; 55 to 74 understandable with noticeable errors; 30 to 54 hard to understand in places; 0 to 29 mostly unintelligible. Attend to vowels (ㅓ/ㅗ, ㅡ/ㅜ), plain, tense, and aspirated consonants (ㄱ/ㄲ/ㅋ), final consonants (받침), and linking (연음).
- Issues name the exact Hangul segment and give a concrete physical tip in simple English.
- Honest scores, kind wording, never mocking.

### 5.7 Acceptance thresholds for real scoring

Measured by the evaluation script (plan 02) on generated and human fixtures:
- A1. Correct sentence in a native-like voice: overall at least 80, for three different missions.
- A2. A different sentence than the target: `jamoSimilarity(heard, target)` below 0.6, so the gate applies and overall is at most 49.
- A3. White noise: `no_speech`.
- A4. English speech: overall at most 49.
- A5. Same file three times: overall spread at most 10.
- A6. Learner-accented human samples score below the native-like clip of the same sentence in at least 4 of 5 pairs (needs the owner's samples, checkpoint H4).
- A7. A recording that asks for a high score instead of saying the sentence: overall at most 49.
- Latency for a 10 second clip: median at most 6 seconds, 95th percentile at most 12.

If A2 fails because the model echoes the target, the fallback is to take `heard` from a separate `gpt-transcribe` call (0.0045 USD per minute) that is not shown the target. If A5 fails, score twice and average.

## 6. Points

All points are computed on the server. The browser never sends a score or a point value.

| Event | Who | Points |
|---|---|---|
| Mission attempt, overall 85 or more | learner | 100% of `basePoints` |
| Mission attempt, overall 70 to 84 | learner | 60% of `basePoints`, rounded |
| Mission attempt, overall 50 to 69 | learner | 30% of `basePoints`, rounded |
| Mission attempt, overall below 50 | learner | 0 |
| Answer gets rated | responder | (pronunciation stars + naturalness stars) × 3, so 6 to 30 |
| Rating an answer | rater | 10 |
| Giving feedback on a rating | responder | 5 |
| Receiving feedback | rater | helpfulness stars × 2, so 2 to 10 |

`basePoints` is 10, 20, or 30 for level 1, 2, 3. A mission can never pay more than its `basePoints` in total: each attempt pays `max(0, tierAward - alreadyEarnedForThisMission)`. Balance is the sum of the user's point events.

Ledger labels: mission `Mission: {korean}`; rated answer `Your answer was rated`; rating given `You rated an answer`; feedback given `Thanks for your feedback`; feedback received `Feedback on your rating`.

## 7. Peer loop rules

- Only `korean` users create challenges. Up to 10 per author per Korea-time day.
- Only `learner` users answer, never their own challenge, one answer per challenge, replaceable until rated. Up to 30 answers per user per day.
- An answer is rated once. The rater is the challenge author, or any `korean` user when the challenge is a sample. The responder can never rate their own answer.
- Feedback is given once, only by the responder, only after the rating.
- Reporting an answer sets `flagged`. Flagged answers disappear from every list and their media is no longer served.
- Sample challenges are seeded from `content/sample-challenges.json`, authored by the system user (id `00000000-0000-4000-8000-000000000001`, nickname `HanLog 팀`) so the board is never empty.
- Share codes are 6 characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`. Lookups ignore letter case.

## 8. Architecture

One Next.js application (App Router, TypeScript, `src/` directory) deployed on Vercel. It serves the introduction page, the app screens, and the JSON API. The browser talks only to this application.

```
Browser (phone first)
  intro page, app screens, recorder, WAV conversion
        |
        |  fetch /api/*  (cookie session, same origin)
        v
Next.js route handlers on Vercel (Node.js runtime)
  session · missions · attempts · points · challenges · responses · media · cron
        |                |                         |
        v                v                         v
  Postgres           Media store              OpenAI API
  prod: Supabase     prod: Supabase Storage   gpt-audio-1.5 (scoring)
  dev/test: PGlite   dev/test: .data/media    omni-moderation-latest (text)
```

Decisions:
- **One SQL implementation.** All persistence goes through a tiny `Db` interface (`query`, `tx`). Development and tests use PGlite (Postgres compiled to WebAssembly, in process, verified working on this machine with Node 24). Production uses `pg` against Supabase Postgres through the transaction pooler. The same migrations and the same queries run in both.
- **Tables live in a private schema `hanlog`**, which Supabase's Data API does not expose. Row level security is enabled on every table with no policies, as a second lock. The application connects as the database owner.
- **Supabase client library is used for Storage only**, on the server, with the secret key. The browser never loads it.
- **Media always flows through our API.** Uploads are capped at 4 MB to stay under Vercel's 4.5 MB request limit. Playback fetches the bytes and plays from a blob URL, which avoids range-request problems on iOS.
- **Library code is framework neutral.** Everything in `src/lib` takes and returns web-standard `Request` and `Response` objects or plain data, so route handlers can be tested by calling them directly.
- **Mutating routes check the `Origin` header** against the request host when the header is present.

Directory map:

```
src/app/                       pages and route handlers
  page.tsx                     introduction
  privacy/page.tsx
  c/[code]/page.tsx
  app/...                      product screens (URL prefix /app)
  api/...                      JSON API
src/components/ui|recorder|mission|challenge|intro
src/lib/
  contracts.ts                 shared types, schemas, limits
  config.ts errors.ts http.ts session.ts content.ts api-client.ts
  audio/wav.ts audio/to-wav.ts
  scoring/types.ts jamo.ts compose.ts mock.ts openai.ts prompt.ts index.ts
  points/rules.ts  limits.ts  moderation.ts
  db/index.ts pglite.ts pg.ts migrate.ts
  repo/users.ts attempts.ts points.ts challenges.ts responses.ts seed.ts
  media/index.ts local.ts supabase.ts sniff.ts
content/                       missions.json rewards.json sample-challenges.json
db/migrations/                 portable SQL
public/audio/missions/         reference clips
scripts/                       migrate, spike, fixtures, reference audio
tests/unit|api|ui|e2e|helpers
```

## 9. Contracts

These TypeScript shapes are authoritative. `src/lib/contracts.ts` implements them as zod schemas named `<Type>Schema` with inferred types.

### 9.1 Types

```ts
type Role = 'learner' | 'korean';
type User = { id: string; nickname: string; role: Role; createdAt: string };

type MissionMode = 'repeat' | 'use';
type Mission = {
  id: string;                 // slug, e.g. "cafe-iced-americano"
  mode: MissionMode;
  korean: string;             // target sentence (repeat) or example sentence (use)
  keyword: string | null;     // required for use, null for repeat
  romanization: string;
  meaningEn: string;
  situationEn: string;        // where and when to say it
  promptEn: string;           // the instruction shown above the recorder
  level: 1 | 2 | 3;
  basePoints: 10 | 20 | 30;   // must equal level * 10
  referenceAudio: string | null; // "/audio/missions/<id>.mp3"
  tags: string[];
};
type MissionWithProgress = Mission & { bestOverall: number | null; pointsEarned: number };

type ScoreIssue = { segment: string; problem: string; tip: string };
type Score = {
  overall: number; pronunciation: number; accuracy: number; usage: number; // integers 0..100
  heard: string;
  issues: ScoreIssue[];       // 0..3
  praise: string;
  nextTip: string;
  scoredBy: 'ai' | 'mock';
};
type Attempt = { id: string; missionId: string; score: Score; pointsAwarded: number; createdAt: string };
type AttemptResult = { attempt: Attempt; balance: number; bestOverall: number; attemptsLeftToday: number };

type PointReason = 'mission' | 'peer_response' | 'peer_rating' | 'peer_feedback';
type PointEvent = { id: string; delta: number; reason: PointReason; label: string; createdAt: string };
type PointsSummary = { balance: number; events: PointEvent[] }; // newest first, at most 50

type Reward = { id: string; category: 'kpop' | 'grocery' | 'fashion' | 'cafe'; title: string; description: string; cost: number };

type MediaKind = 'audio' | 'video';
type ChallengeScope = 'open' | 'mine' | 'to-rate' | 'answered';
type Challenge = {
  id: string; code: string;
  author: { id: string; nickname: string };
  korean: string; meaningEn: string; situationEn: string;
  hasReference: boolean;
  isSample: boolean;
  createdAt: string;
  viewer: { responded: boolean; pendingToRate: number };
};
type PeerRating = { pronunciation: number; naturalness: number; comment: string; ratedAt: string }; // 1..5
type PeerFeedback = { helpfulness: number; comment: string; givenAt: string };                     // 1..5
type ChallengeResponse = {
  id: string; challengeId: string;
  responder: { id: string; nickname: string };
  mediaKind: MediaKind;
  mediaAvailable: boolean;    // false after expiry or deletion
  durationMs: number;
  status: 'pending' | 'rated';
  rating: PeerRating | null;
  feedback: PeerFeedback | null;
  createdAt: string;
};
type ViewerRole = 'author' | 'rater' | 'responder' | 'visitor';
type ChallengeDetail = {
  challenge: Challenge;
  viewerRole: ViewerRole;
  myResponse: ChallengeResponse | null;   // set for responder
  responses: ChallengeResponse[];         // filled for author and rater, empty otherwise
};

type ApiErrorCode =
  | 'unauthenticated' | 'forbidden' | 'not_found' | 'invalid_input' | 'conflict'
  | 'audio_too_large' | 'audio_invalid' | 'media_invalid' | 'no_speech' | 'content_rejected'
  | 'daily_limit' | 'scoring_failed' | 'budget_exhausted' | 'service_unavailable' | 'internal';
type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };
```

HTTP status by code: `unauthenticated` 401, `forbidden` 403, `not_found` 404, `invalid_input` 400, `conflict` 409, `audio_too_large` 413, `audio_invalid` 415, `media_invalid` 415, `no_speech` 422, `content_rejected` 422, `daily_limit` 429, `scoring_failed` 502, `budget_exhausted` 503, `service_unavailable` 503, `internal` 500.

### 9.2 Limits

```ts
const LIMITS = {
  nickname: { min: 2, max: 20 },
  challengeKorean: { min: 1, max: 60 },
  meaningEn: { min: 1, max: 120 },
  situationEn: { max: 200 },
  comment: { max: 200 },
  scoringWav: { sampleRate: 16000, minMs: 500, maxMs: 20000, maxBytes: 700_000 },
  peerMedia: { maxBytes: 4_000_000, maxMs: 20000 },
  recorder: { maxSeconds: 15, minMs: 500 },
  silenceRms: 0.01,
} as const;
```

Lengths count Unicode code points, not UTF-16 units. Nicknames allow letters (any script, including Hangul), digits, spaces, and `. _ -`.

Allowed peer media types (the part before any `;`): `audio/webm`, `audio/mp4`, `audio/ogg`, `audio/wav`, `video/webm`, `video/mp4`. The declared type must match both the `kind` and the file's magic bytes.

### 9.3 API

Every error is `ApiErrorBody`. Every route except `GET /api/session`, `GET /api/missions`, `GET /api/rewards`, and the cron route requires a session and answers 401 `unauthenticated` without one.

| Method and path | Request | Success |
|---|---|---|
| `GET /api/session` | | 200 `{ user: User \| null }` |
| `POST /api/session` | JSON `{ nickname, role, consent: true }` | 201 `{ user }` and the session cookie. With an existing valid session: 200 with that user, no new row. |
| `PATCH /api/session` | JSON `{ nickname?, role? }` | 200 `{ user }` |
| `DELETE /api/session` | | 204, cookie cleared, data deleted |
| `GET /api/missions` | | 200 `{ missions: MissionWithProgress[], today: string[] }` (progress empty without a session) |
| `POST /api/missions/[id]/attempts` | multipart: `audio` (WAV file) | 200 `AttemptResult` |
| `GET /api/points` | | 200 `PointsSummary` |
| `GET /api/rewards` | | 200 `{ rewards: Reward[] }` |
| `GET /api/challenges?scope=` | scope is a `ChallengeScope` | 200 `{ challenges: Challenge[] }` (at most 50) |
| `POST /api/challenges` | multipart: `korean`, `meaningEn`, `situationEn`, optional `media` (audio file), optional `durationMs` | 201 `{ challenge }` |
| `GET /api/challenges/[id]` | id or share code | 200 `ChallengeDetail` |
| `GET /api/challenges/[id]/reference` | | 200 media bytes |
| `POST /api/challenges/[id]/responses` | multipart: `media`, `kind`, `durationMs` | 201 `{ response }` |
| `POST /api/responses/[id]/rating` | JSON `{ pronunciation, naturalness, comment }` | 200 `{ response }` |
| `POST /api/responses/[id]/feedback` | JSON `{ helpfulness, comment }` | 200 `{ response }` |
| `POST /api/responses/[id]/report` | | 204 |
| `GET /api/responses/[id]/media` | | 200 media bytes |
| `GET /api/cron/cleanup` | header `Authorization: Bearer <CRON_SECRET>` | 200 `{ deleted: number }` |

Attempt route check order (each failure stops there): session → mission exists (404) → `audio` present (400) → size (413 `audio_too_large`) → WAV validation (415 `audio_invalid`) → root mean square below `silenceRms` (422 `no_speech`, no model call, no cap consumed) → reserve a scoring call (429 `daily_limit` for the user or address cap, 503 `budget_exhausted` for the global cap) → score (422 `no_speech`, 502 `scoring_failed`) → store and award → respond.

Media responses carry the stored content type, `Cache-Control: private, no-store`, and `X-Content-Type-Options: nosniff`.

### 9.4 Derived values

- Korea-time day: caps and "today" use the calendar day in `Asia/Seoul`.
- `todaysMissionIds(dateKst)`: for each level, take the missions of that level in file order and pick index `dayOfYear % count`. Returns three ids, level 1 first.
- Address hash: SHA-256 of the first `x-forwarded-for` entry concatenated with `SESSION_SECRET`, first 32 hex characters; `"unknown"` when the header is missing.

## 10. Data model

Portable SQL in `db/migrations/0001_init.sql`. All tables are in schema `hanlog` with row level security enabled and no policies.

```sql
create schema if not exists hanlog;

create table hanlog.users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  role text not null check (role in ('learner','korean')),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create table hanlog.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hanlog.users(id) on delete cascade,
  mission_id text not null,
  overall int not null, pronunciation int not null, accuracy int not null, usage int not null,
  heard text not null,
  feedback jsonb not null,               -- { issues, praise, nextTip }
  scored_by text not null check (scored_by in ('ai','mock')),
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index attempts_user_mission on hanlog.attempts (user_id, mission_id);

create table hanlog.scoring_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ip_hash text not null,
  outcome text not null default 'pending' check (outcome in ('pending','scored','no_speech','failed')),
  created_at timestamptz not null default now()
);
create index scoring_calls_created on hanlog.scoring_calls (created_at);

create table hanlog.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hanlog.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('mission','peer_response','peer_rating','peer_feedback')),
  ref_id text not null,
  label text not null,
  created_at timestamptz not null default now()
);
create index point_events_user on hanlog.point_events (user_id, created_at desc);

create table hanlog.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  author_id uuid not null references hanlog.users(id) on delete cascade,
  korean text not null,
  meaning_en text not null,
  situation_en text not null default '',
  reference_path text,
  reference_mime text,
  is_sample boolean not null default false,
  status text not null default 'open' check (status in ('open','hidden')),
  created_at timestamptz not null default now()
);

create table hanlog.challenge_responses (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references hanlog.challenges(id) on delete cascade,
  responder_id uuid not null references hanlog.users(id) on delete cascade,
  media_path text,
  media_kind text not null check (media_kind in ('audio','video')),
  media_mime text not null,
  duration_ms int not null,
  status text not null default 'pending' check (status in ('pending','rated')),
  flagged boolean not null default false,
  rater_id uuid references hanlog.users(id) on delete set null,
  rating_pronunciation int check (rating_pronunciation between 1 and 5),
  rating_naturalness int check (rating_naturalness between 1 and 5),
  rating_comment text,
  rated_at timestamptz,
  feedback_helpfulness int check (feedback_helpfulness between 1 and 5),
  feedback_comment text,
  feedback_at timestamptz,
  created_at timestamptz not null default now(),
  unique (challenge_id, responder_id)
);
```

Media paths: `responses/<responseId>.<ext>` and `references/<challengeId>.<ext>`, with `ext` one of `webm`, `mp4`, `ogg`, `wav`.

Concurrency: awarding points happens inside a transaction that first takes `pg_advisory_xact_lock(hashtext(<user id>))`. Reserving a scoring call takes `pg_advisory_xact_lock(hashtext('scoring_calls'))`.

## 11. Configuration

| Variable | Meaning | Default |
|---|---|---|
| `SESSION_SECRET` | HMAC key for the session cookie, at least 32 characters | Required in production. A fixed development value otherwise. |
| `DATABASE_URL` (or `POSTGRES_URL`) | Postgres connection string. Present means driver `pg`. | Absent means PGlite. |
| `PGLITE_DIR` | Folder for PGlite files | In memory when unset |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) | Storage. Both present means media driver `supabase`. | Otherwise local folder `.data/media` |
| `MEDIA_BUCKET` | Storage bucket name | `recordings` |
| `OPENAI_API_KEY` | Enables real scoring and text moderation | Absent means mock scoring and rule-only moderation |
| `SCORING_PROVIDER` | `openai` or `mock`, overrides the automatic choice | |
| `OPENAI_SCORING_MODEL` | | `gpt-audio-1.5` |
| `USER_DAILY_ATTEMPTS` | Scoring calls per user per day | 30 |
| `IP_DAILY_ATTEMPTS` | Scoring calls per address hash per day | 600 |
| `GLOBAL_DAILY_ATTEMPTS` | Scoring calls for everyone per day | 1500 |
| `IP_DAILY_SESSIONS` | New users per address hash per day | 200 |
| `RETENTION_DAYS` | Days before stored recordings are deleted | 14 |
| `CRON_SECRET` | Bearer token for the cleanup route | Required in production |

On Vercel (the platform sets `VERCEL=1`) the application refuses to start without a database URL and without both Supabase storage values, because the in-process database and the local media folder would silently lose data there.

Address caps are deliberately loose because a classroom shares one address. The global cap is the real spending guard: at an estimated half a cent per attempt it bounds the day at under 10 USD. That estimate is unverified and gets measured in the spike.

Session cookie: name `hl_session`, JWT signed HS256 with `SESSION_SECRET`, claim `sub` is the user id, 90 days, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production.

## 12. Privacy, safety, abuse

- Solo recordings are never stored. The WAV is held in memory for the model call and dropped.
- Peer recordings and challenge reference clips are stored in a private bucket and deleted `RETENTION_DAYS` after upload by a daily job. After deletion `mediaAvailable` is false.
- "Delete my data" removes the user and everything that belongs to them, including stored recordings, immediately.
- Consent text, shown at onboarding and at the live try panel: "I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days. I am 14 or older."
- Text that other users will see (nickname, challenge fields, comments) is checked: links (`http://`, `https://`, `www.`) are always rejected; when an OpenAI key is configured the text is also sent to the free moderation endpoint (`omni-moderation-latest`) and rejected when flagged. If the moderation call fails the request fails with `service_unavailable`.
- Recordings are not moderated automatically. They are only heard by the people entitled to rate them, and every answer has a Report link.
- Logs never contain audio, cookies, keys, or full nicknames with addresses.
- The privacy page says who operates the demo, what is collected (nickname, role, hashed address, scores, recordings as above), where it goes (Vercel, Supabase, OpenAI), how long it is kept, and how to delete it. It makes no claims about OpenAI's retention beyond linking to OpenAI's policy.

## 13. Content rules

Missions (target: 24, with 12 at level 1, 8 at level 2, 4 at level 3; at least 6 of mode `use`):
- Polite, natural Korean that a student in Seoul would really use: café, convenience store, campus, transit, shopping, friends, fandom.
- No digits and no Latin letters in `korean`. Numbers are spelled in Hangul.
- `repeat` sentences are 4 to 25 syllables.
- `use` keywords are fixed-form words that do not conjugate (interjections, nouns, set slang), so a plain substring check works. The `korean` field holds an example sentence that contains the keyword.
- Level 1 is survival phrases, level 2 daily life with some connected speech and 받침 load, level 3 campus or work sentences and current slang.
- Romanization follows Revised Romanization.
- No real brand names, celebrity names, or group names.

Seed examples that set the quality bar:

| id | mode | level | korean | keyword | meaningEn |
|---|---|---|---|---|---|
| `cafe-iced-americano` | repeat | 1 | 아이스 아메리카노 한 잔 주세요. | | One iced americano, please. |
| `greet-nice-to-meet` | repeat | 1 | 만나서 반갑습니다. | | Nice to meet you. |
| `store-no-receipt` | repeat | 2 | 영수증은 버려 주세요. | | Please throw the receipt away. |
| `transit-this-stop` | repeat | 2 | 이번 역에서 내려요. | | I'm getting off at this station. |
| `slang-daebak` | use | 2 | 대박, 이 노래 진짜 좋다! | 대박 | "Wow, amazing": said when something is surprisingly great. |
| `campus-group-roles` | repeat | 3 | 조별 과제 역할을 어떻게 나눌까요? | | How should we divide the roles for the group project? |

Sample challenges (target: 8) are slang a Korean student would actually teach a friend, each with a sentence, a meaning, and a situation. Slang ages quickly, so a native speaker reviews the list before launch (checkpoint H3).

Rewards catalog (generic, no brands): K-pop album voucher 3000, photocard set voucher 1200, grocery 10,000 won coupon 1000, fashion 10% off coupon 800, convenience store 5,000 won coupon 500, café drink coupon 400.

Reference clips are generated once with text-to-speech and committed as static files. The interface labels them "AI voice".

Tone everywhere: warm, specific, encouraging, never cute at the cost of clarity. Sentence case. No exclamation marks in error messages except the two in section 4.11.

## 14. Design

Use the Open Window direction (`Sky, Buttercream & Berry` · `v0.4`) in `../design/open-window/DESIGN.md` and `tokens.json` (one level above this repository). Mapped tokens:

| Token | Value | Use |
|---|---|---|
| canvas | `#D2F6FC` | pastel sky page background |
| surface | `#FFFEF9` | milky cloud-white cards, sheets |
| ink | `#1E2436` | midnight star-navy titles, body, and button text |
| text-secondary | `#4A566D` | dusk slate metadata |
| action | `#FC7CAC` | strawberry pink primary button fill (`#1E2436` ink, `#B02D63` edge) |
| action-stroke | `#B02D63` | accessible berry rose for links, selection, focus, `✓` squares |
| action-soft | `#FCE6EF` | soft blush wash for active/saved states |
| buttercream | `#FCFCC6` | lemon buttercream welcoming note per screen (`#1E2436` ink only) |
| sky-star / blush-star | `#7CE4FC` / `#FCC4D8` | bright sky and blush decorative accents (`#1E2436` ink only) |
| line | `#A8D3DF` | sky-tinted decorative separators |
| control-edge | `#5E7B8C` | slate-sky input borders |
| error-ink / error-surface | `#A32029` / `#FFF0EE` | errors |

Radii: field 8, button and media 12, sheet 20, badge 6. Spacing scale 4, 8, 12, 16, 24, 32, 48. Minimum touch target 48 px. Focus ring 3 px `actionStroke` (`#B02D63`) with 3 px offset. Title font stack `Georgia, Batang, serif`; body `"Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`. No web font downloads. Motion: press 120 ms, selection 160 ms, panel 220 ms with at most 8 px travel; reduced motion switches to instant or a short fade.

Signature rules to keep: the margin organizes labels and content (56 to 72 px on wide screens, 28 to 36 px rail on phones, stacked above content at very narrow widths); at most one corner mark per view; captions and actions sit below media; primary actions are labelled rectangles with a verb; success is acknowledged in place with a check, words, and a filled margin marker.

Elaborated v0.4 structural component tokens in `../design/open-window/tokens.json` and interactive screen archetypes in `../design/open-window/reference.html`: `cornerMark` (`12 px` size, `2.5 px` stroke, `actionStroke`, max 1 per view), `statusMarker` (`26 × 26 px`, `6 px` radius, `controlBorder` idle, `actionStroke` berry fill on saved, `errorInk` fill on error), `personAvatar` (`28 px` circle, reserved exclusively for people, capture controls, and progress indicators), and `captureSheet` (`20 px` sheet radius, `8 px` input radius with `controlBorder`).

Do not carry over the old static site's lime accent (`#dced91`), its photo collage, or anything from the Setlog reference study.

Plan 01 copies `../design/open-window/` into this repository as `docs/design/open-window/`, so every worktree has the design files, and pins the stylesheet to that copy with a test. When the two folders differ, the one outside the repository is newer: refresh the copy, then the stylesheet.

## 15. Testing

- Unit tests (Vitest, Node environment): everything in `src/lib`.
- API tests (Vitest, Node environment): route handlers called directly with a fresh in-memory PGlite, the local media driver in a temp folder, and the mock scorer.
- Component tests (Vitest, jsdom, Testing Library): hooks and components, with the API client and browser media mocked.
- End to end (Playwright, Chromium with a fake microphone fed from a WAV file): the solo loop and the peer loop against a production build running the mock scorer.
- Scoring evaluation (manual trigger, needs a key): section 5.7.
- `npm run check` runs type check, lint, and all Vitest suites and must be green before any merge.

## 16. Deployment

- Vercel project, Node.js 24, default Node.js runtime (never the Edge runtime), functions in Seoul (`icn1`).
- Supabase project in Seoul (`ap-northeast-2`): Postgres through the transaction pooler connection string, one private Storage bucket `recordings`.
- Configuration file `vercel.ts` with one daily cron, `0 18 * * *` UTC (03:00 in Korea), calling `/api/cron/cleanup`.
- Migrations are applied with `npm run db:migrate` (our own runner; the Supabase CLI migration workflow is not used because the SQL has to stay portable to PGlite).
- If the dev server or build misbehaves because the repository sits under a path with non-ASCII characters (`대웅`), move the `hanlog` folder to an ASCII path. Nothing in the repository depends on its location.

## 17. Calls made by the planner (override freely)

1. Stack: Next.js 16 on Vercel, Supabase Postgres and Storage. PGlite in development and tests.
2. Direct SQL through `pg` in a private schema, instead of the Supabase Data API with policies.
3. OpenAI called with `fetch`, no SDK.
4. Peer loop is asynchronous through a board and share links, with seeded sample challenges that any Korean-role user may rate.
5. Human star ratings only in the peer loop. The AI does not score peer answers.
6. Video is optional everywhere; the AI scores the audio track only. In the solo loop video never leaves the browser.
7. Points table in section 6, and a mission never pays more than its base points.
8. Caps in section 11, tuned for a classroom on one network.
9. 14 day retention and the consent wording, including "14 or older".
10. English interface.
11. Generic reward names and no partner or sponsor names anywhere, including no project credit in the footer.
12. The old static site in `../app-introduction` is left untouched and is superseded by this application.

## 18. Things only the owner can do

- H1. Provide an OpenAI API key with access to `gpt-audio-1.5`, and set a monthly spending limit in the OpenAI dashboard. Needed by plan 02 task 1; nothing else waits on it.
- H2. Authorize Supabase and Vercel for the deploying agent, or create the two projects by hand and paste the values. Needed by plan 07.
- H3. Have a native Korean speaker review `content/missions.json` and `content/sample-challenges.json`.
- H4. Record at least five short learner-accented samples of mission sentences (with the speakers' consent) for threshold A6.
- H5. Try the deployed site on one real iPhone and one real Android phone.
- H6. Decide the public name of the operator for the privacy page, and whether the footer should credit the team.

## 19. External facts and where they came from

Checked on 2026-11-15.
- Claude's Messages API has no audio input block, which is why scoring uses another provider. Source: platform.claude.com/docs/en/api/messages/create.
- OpenAI audio model, request shape, endpoint support, price: developers.openai.com/api/docs/models/gpt-audio-1.5 and /api/docs/guides/audio-chat-completions.
- OpenAI deprecations (audio mini and text-to-speech shutdown dates): developers.openai.com/api/docs/deprecations. `gpt-4o-mini-tts`, `tts-1`, and `tts-1-hd` shut down on 2027-01-06, which is fine for one-time generation of reference clips before then.
- OpenAI moderation model and response shape: developers.openai.com/api/docs/guides/moderation.
- OpenAI transcription model `gpt-transcribe` and its price: developers.openai.com/api/docs/guides/speech-to-text and /api/docs/pricing.
- Vercel limits and defaults (4.5 MB request body, 300 s default timeout, Node.js 24, `vercel.ts`, Edge runtime deprecated): Vercel knowledge update dated 2026-09-18.
- Package versions current on npm: next 16.4.6, react 19.3.1, tailwindcss 4.3.5, zod 4.6.7, jose 6.2.17, pg 8.23.1, @electric-sql/pglite 0.5.16, @supabase/supabase-js 2.119.0, vitest 5.1.0, @playwright/test 1.65.1.
- PGlite 0.5.16 on Node 24.15 on this machine: schema creation, `gen_random_uuid()`, row level security, advisory locks, transactions with rollback, `jsonb`, and time zone arithmetic all ran correctly.
