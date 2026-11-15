# HanLog Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every product screen under `/app`, the share-link page, and the reusable recorder and score card, all phone first and in the Open Window design.

**Architecture:** Client components that read and write only through `api` from `src/lib/api-client.ts`. A session provider guards `/app/*`. Recording is a hook (`useRecorder`) with injected browser dependencies so it is testable, wrapped by a `Recorder` component. `MissionFlow` composes recorder, WAV conversion, submission, and `ScoreCard`, and is reused by the introduction page.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 with the tokens from the foundation, Vitest with jsdom and Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md`, sections 4, 9, 14. Design direction: `docs/design/open-window/DESIGN.md`. Orchestration: `docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md`.

## Global Constraints

- Server access only through `api` from `@/lib/api-client`. No `fetch` in components except inside that module.
- Screen text, labels, and error wording are exactly as spec section 4, including section 4.11.
- Every Korean string is rendered through the `Ko` component (`lang="ko"`).
- Design for 390 px width first, usable at 320 px, comfortable at 1440 px. No horizontal scrolling at any of those widths.
- Tokens only (spec section 14). Touch targets at least 48 px. Visible focus. Respect reduced motion. At most one corner mark per screen. Captions and actions below media.
- State is never signalled by color alone: pair it with text or an icon.
- Microphone and camera are requested only after a tap, and released when recording ends, when the page is hidden, and on unmount.
- No new dependencies. `package.json` is frozen.
- Edit only: `src/components/{ui,recorder,mission,challenge}/**`, `src/app/app/**`, `src/app/c/**`, `src/lib/audio/to-wav.ts`, `src/lib/ui/**`, `tests/ui/**` (except `tests/ui/intro/**`), `docs/handoffs/frontend.md`. You may add utilities to `src/app/globals.css`.
- Component tests mock two modules, always the same way:

```ts
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
```

## Review Focus

1. Microphone permission denied, or no `MediaRecorder` at all: the user must still have a way forward (upload a voice file) and a clear message. Pinned in tasks 3 and 4.
2. Leaving the tab while recording: recording stops and the microphone is released. Pinned in task 3.
3. Tapping the submit button twice, or tapping during the ten-second scoring wait: exactly one request. Pinned in tasks 4 and 8.
4. An object URL created for playback is revoked when the player unmounts or the source changes. Pinned in task 12.
5. A `next` parameter pointing off-site must not redirect there. Pinned in task 6.

---

### Task 1: UI primitives

**Files:**
- Create: `src/components/ui/{Button,Field,Surface,MarginRow,CornerMark,StatusNote,Stars,Meter,PointsChip,Ko}.tsx`, `src/components/ui/index.ts`, `tests/ui/_helpers.tsx`
- Test: `tests/ui/primitives.test.tsx`

**Interfaces:**
- Produces:

```tsx
Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'text'; busy?: boolean; busyLabel?: string })
Field(props: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; counter?: { value: number; max: number } })
TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string; counter?: { value: number; max: number } })
Surface(props: { tone?: 'surface' | 'apricot'; children: ReactNode; className?: string })
MarginRow(props: { label: ReactNode; marker?: 'empty' | 'filled'; children: ReactNode })   // margin beside content on wide screens, rail on phones, stacked below 360 px
CornerMark(props: { children: ReactNode })                                                    // wraps the one active heading of a screen
StatusNote(props: { tone: 'info' | 'success' | 'error'; children: ReactNode })              // role="status", or role="alert" for error; always an icon plus text
Stars(props: { label: string; value: number | null; onChange?: (value: number) => void })   // five radios in a radiogroup; without onChange it is read-only with accessible name "<label>: 4 out of 5"
Meter(props: { label: string; value: number })                                              // role="meter", 0..100, shows the number as text
PointsChip(props: { balance: number | null })                                               // "★ 120 points", or "★ …" while null
Ko(props: { children: ReactNode; as?: 'span' | 'p' | 'h1' | 'h2' | 'h3'; className?: string }) // sets lang="ko"

// tests/ui/_helpers.tsx
export const nav: { push: Mock; replace: Mock; params: Record<string, string>; pathname: string; search: URLSearchParams };
export const navigationMock: { useRouter(): { push: Mock; replace: Mock }; useParams(): Record<string, string>; usePathname(): string; useSearchParams(): URLSearchParams };
export const mockApi: { [K in keyof typeof import('@/lib/api-client').api]: Mock };  // mediaUrl is { response: Mock; reference: Mock }
export function resetMocks(): void;   // clears every mock and restores nav defaults (pathname '/app', empty params and search)
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Button, Field, Ko, Meter, PointsChip, Stars, StatusNote } from '@/components/ui';

it('Button disables itself while busy and says why', async () => {
  const onClick = vi.fn();
  render(<Button busy busyLabel="Listening…" onClick={onClick}>Get my score</Button>);
  const button = screen.getByRole('button', { name: 'Listening…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});
it('Field ties label, hint, error, and counter to the input', () => {
  render(<Field label="Nickname" hint="2 to 20 characters" error="Too short" counter={{ value: 1, max: 20 }} defaultValue="a" />);
  const input = screen.getByLabelText('Nickname');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(/Too short/);
  expect(screen.getByText('1 / 20')).toBeInTheDocument();
});
it('Stars works as a radio group with keyboard and pointer', async () => {
  const onChange = vi.fn();
  render(<Stars label="Pronunciation" value={null} onChange={onChange} />);
  expect(screen.getByRole('radiogroup', { name: 'Pronunciation' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
  expect(onChange).toHaveBeenCalledWith(4);
});
it('Stars is a labelled image when read-only', () => {
  render(<Stars label="Naturalness" value={4} />);
  expect(screen.getByRole('img', { name: 'Naturalness: 4 out of 5' })).toBeInTheDocument();
  expect(screen.queryByRole('radio')).toBeNull();
});
it('StatusNote announces politely, and errors assertively', () => {
  render(<><StatusNote tone="success">Saved.</StatusNote><StatusNote tone="error">That didn't score yet. Try again.</StatusNote></>);
  expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  expect(screen.getByRole('alert')).toHaveTextContent("That didn't score yet. Try again.");
});
it('Meter exposes its value and shows the number', () => {
  render(<Meter label="Pronunciation" value={84} />);
  const meter = screen.getByRole('meter', { name: 'Pronunciation' });
  expect(meter).toHaveAttribute('aria-valuenow', '84');
  expect(screen.getByText('84')).toBeInTheDocument();
});
it('Ko marks Korean text and PointsChip shows the balance', () => {
  render(<><Ko as="p">안녕하세요</Ko><PointsChip balance={120} /><PointsChip balance={null} /></>);
  expect(screen.getByText('안녕하세요')).toHaveAttribute('lang', 'ko');
  expect(screen.getByText('★ 120 points')).toBeInTheDocument();
  expect(screen.getByText('★ …')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/ui/primitives.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the components and `tests/ui/_helpers.tsx`. Primary buttons: `action` background (`action-hover` on hover), `surface` text, 12 px radius, minimum height 48 px, 18 to 24 px horizontal padding. Secondary: outline in `control-edge`. Text: underlined label. Add `overflow-wrap: anywhere` to `Ko`. Corner mark, status marker, and avatar sizes come from `components` in `docs/design/open-window/tokens.json`; saved and selected states use the `action-soft` wash.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 7 tests.
- [ ] **Step 5: Commit.** `git add src/components/ui tests/ui && git commit -m "feat: Open Window UI primitives"`

---

### Task 2: Browser audio to scoring WAV

**Files:**
- Create: `src/lib/audio/to-wav.ts`
- Test: `tests/ui/to-wav.test.tsx`

**Interfaces:**
- Consumes: `encodeWavPcm16`, `resampleLinear` from `@/lib/audio/wav`; `LIMITS`.
- Produces:

```ts
export type Decoder = (data: ArrayBuffer) => Promise<{ sampleRate: number; channels: Float32Array[] }>;
export class ConvertError extends Error { readonly code: 'undecodable' | 'too_short'; }
export function toMono16k(channels: Float32Array[], sampleRate: number, maxMs?: number): Float32Array; // average channels, resample to 16000, cut at maxMs (default LIMITS.scoringWav.maxMs)
export function blobToScoringWav(blob: Blob, decode?: Decoder): Promise<Uint8Array>;                  // default decoder: AudioContext.decodeAudioData
```

- [ ] **Step 1: Write the failing test**

```tsx
import { expect, it } from 'vitest';
import { ConvertError, blobToScoringWav, toMono16k } from '@/lib/audio/to-wav';
import { validateScoringWav } from '@/lib/audio/wav';

const tone = (seconds: number, rate: number, amp = 0.5) => Float32Array.from({ length: seconds * rate }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / rate));

it('mixes to mono and resamples to 16 kHz', () => {
  const out = toMono16k([new Float32Array(48000).fill(0.2), new Float32Array(48000).fill(0.6)], 48000);
  expect(out).toHaveLength(16000);
  expect(out[8000]).toBeCloseTo(0.4, 5);
});
it('cuts recordings longer than the limit', () => {
  expect(toMono16k([new Float32Array(25 * 16000)], 16000)).toHaveLength(20 * 16000);
});
it('produces a WAV the server will accept', async () => {
  const decode = async () => ({ sampleRate: 44100, channels: [tone(2, 44100)] });
  const info = validateScoringWav(await blobToScoringWav(new Blob([new Uint8Array(10)], { type: 'audio/webm' }), decode));
  expect(info).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 2000 });
});
it('reports undecodable and too-short input', async () => {
  const blob = new Blob([new Uint8Array(10)]);
  await expect(blobToScoringWav(blob, async () => { throw new Error('bad data'); })).rejects.toMatchObject({ code: 'undecodable' });
  await expect(blobToScoringWav(blob, async () => ({ sampleRate: 16000, channels: [new Float32Array(3200)] }))).rejects.toMatchObject({ code: 'too_short' });
  await expect(blobToScoringWav(blob, async () => ({ sampleRate: 16000, channels: [] }))).rejects.toBeInstanceOf(ConvertError);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** The default decoder creates an `AudioContext` (falling back to `webkitAudioContext`), calls `decodeAudioData`, reads each channel, and closes the context. "Too short" is under `LIMITS.recorder.minMs`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 4 tests.
- [ ] **Step 5: Commit.** `git add src/lib/audio/to-wav.ts tests/ui/to-wav.test.tsx && git commit -m "feat: browser recording to 16 kHz mono WAV"`

---

### Task 3: `useRecorder`

**Files:**
- Create: `src/components/recorder/useRecorder.ts`, `tests/ui/_fakes.ts`
- Test: `tests/ui/use-recorder.test.tsx`

**Interfaces:**
- Produces:

```ts
export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported' | 'error';
export type RecorderResult = { blob: Blob; audioBlob: Blob; kind: MediaKind; mimeType: string; durationMs: number }; // audioBlob === blob for audio
export type RecorderDeps = {
  supported: () => boolean;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  audioOnly: (stream: MediaStream) => MediaStream;
  isTypeSupported: (type: string) => boolean;
  createLevelMeter: (stream: MediaStream) => { read(): number; close(): void };   // 0..1
  now: () => number;
};
export function pickMimeType(kind: MediaKind, isTypeSupported: (type: string) => boolean): string | undefined;
export function useRecorder(opts?: { maxSeconds?: number; deps?: Partial<RecorderDeps> }): {
  status: RecorderStatus; mode: MediaKind; setMode(mode: MediaKind): void;
  stream: MediaStream | null; elapsedMs: number; level: number;
  result: RecorderResult | null; message: string | null;
  start(): Promise<void>;   // asks for permission if needed, then records
  stop(): void;
  reset(): void;            // back to idle, discards the result
};

// tests/ui/_fakes.ts
export function fakeStream(): MediaStream & { stopped(): boolean };
export class FakeMediaRecorder { /* start(), stop() emitting dataavailable then stop; mimeType from options */ }
export function fakeDeps(over?: Partial<RecorderDeps>): RecorderDeps & { clock: { advance(ms: number): void }; streams: Array<ReturnType<typeof fakeStream>> };
```

Candidate types, first supported wins. Audio: `audio/webm;codecs=opus`, `audio/mp4`, `audio/ogg;codecs=opus`, `audio/webm`. Video: `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/mp4`, `video/webm`.

Constraints. Audio mode: `{ audio: true }`. Video mode: `{ audio: true, video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } } }` with `videoBitsPerSecond: 800_000` and `audioBitsPerSecond: 64_000`. In video mode two recorders run: one on the full stream, one on `audioOnly(stream)`.

Messages (exact): denied: `Microphone access is off. Allow it in your browser settings, or upload a voice file.` Unsupported: `This browser can't record here. You can upload a voice file instead.` Too short: `That was too short. Speak for at least a second.` Left the page: `Recording stopped because you left the page.` Other failure: `We couldn't start recording. Try again.`

- [ ] **Step 1: Write the failing test**

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { pickMimeType, useRecorder } from '@/components/recorder/useRecorder';
import { fakeDeps } from './_fakes';

it('picks the first supported type', () => {
  expect(pickMimeType('audio', (t) => t === 'audio/mp4')).toBe('audio/mp4');
  expect(pickMimeType('video', (t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
  expect(pickMimeType('audio', () => false)).toBeUndefined();
});
it('records audio from one tap and releases the microphone', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  expect(result.current.status).toBe('recording');
  act(() => { deps.clock.advance(3200); result.current.stop(); });
  await waitFor(() => expect(result.current.status).toBe('recorded'));
  expect(result.current.result).toMatchObject({ kind: 'audio', mimeType: 'audio/webm;codecs=opus', durationMs: 3200 });
  expect(result.current.result!.audioBlob).toBe(result.current.result!.blob);
  expect(deps.streams[0].stopped()).toBe(true);
});
it('records video plus a separate audio-only track', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  act(() => result.current.setMode('video'));
  await act(() => result.current.start());
  act(() => { deps.clock.advance(2000); result.current.stop(); });
  await waitFor(() => expect(result.current.status).toBe('recorded'));
  expect(result.current.result!.kind).toBe('video');
  expect(result.current.result!.blob.type).toContain('video/');
  expect(result.current.result!.audioBlob.type).toContain('audio/');
});
it('stops by itself at the maximum length', async () => {
  vi.useFakeTimers();
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ maxSeconds: 15, deps }));
  await act(() => result.current.start());
  await act(async () => { deps.clock.advance(15000); await vi.advanceTimersByTimeAsync(15000); });
  expect(result.current.status).toBe('recorded');
  expect(result.current.result!.durationMs).toBe(15000);
  vi.useRealTimers();
});
it('explains a denied permission and an unsupported browser', async () => {
  const denied = fakeDeps({ getUserMedia: async () => { throw new DOMException('no', 'NotAllowedError'); } });
  const a = renderHook(() => useRecorder({ deps: denied }));
  await act(() => a.result.current.start());
  expect(a.result.current.status).toBe('denied');
  expect(a.result.current.message).toBe('Microphone access is off. Allow it in your browser settings, or upload a voice file.');
  const b = renderHook(() => useRecorder({ deps: fakeDeps({ supported: () => false }) }));
  await act(() => b.result.current.start());
  expect(b.result.current.status).toBe('unsupported');
});
it('discards a recording that is too short', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  act(() => { deps.clock.advance(200); result.current.stop(); });
  await waitFor(() => expect(result.current.status).toBe('idle'));
  expect(result.current.result).toBeNull();
  expect(result.current.message).toBe('That was too short. Speak for at least a second.');
});
it('stops and releases when the page is hidden or the component unmounts', async () => {
  const deps = fakeDeps();
  const { result, unmount } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  act(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await waitFor(() => expect(result.current.status).toBe('idle'));
  expect(result.current.message).toBe('Recording stopped because you left the page.');
  expect(deps.streams[0].stopped()).toBe(true);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  await act(() => result.current.start());
  unmount();
  expect(deps.streams[1].stopped()).toBe(true);
});
it('ignores a second start while one is in progress', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(async () => { await Promise.all([result.current.start(), result.current.start()]); });
  expect(deps.streams).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** the hook and the fakes. Default dependencies use `navigator.mediaDevices`, `MediaRecorder`, `new MediaStream(stream.getAudioTracks())`, and an `AnalyserNode` level meter. `durationMs` comes from `now()` at start and stop, capped at `maxSeconds * 1000`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 8 tests.
- [ ] **Step 5: Commit.** `git add src/components/recorder tests/ui && git commit -m "feat: useRecorder hook with injected browser dependencies"`

---

### Task 4: `Recorder` component

**Files:**
- Create: `src/components/recorder/Recorder.tsx`
- Test: `tests/ui/recorder.test.tsx`

**Interfaces:**
- Produces:

```tsx
export function Recorder(props: {
  modes: MediaKind[];                       // ['audio'] or ['audio', 'video']
  submitLabel: string;                      // e.g. "Get my score", "Send answer"
  onSubmit(result: RecorderResult): void;   // called once per recording
  busy?: boolean; busyLabel?: string;       // while the parent is uploading or scoring
  allowUpload?: boolean;                    // shows "Upload a voice file" (audio only)
  deps?: Partial<RecorderDeps>;
}): JSX.Element;
```

Screen text: record button `Record`; while recording `Stop` and a timer like `0:07 / 0:15`; mode toggle labels `Voice` and `Video`; after recording `Retake` and the submit label; upload control `Upload a voice file`. An uploaded file becomes `{ blob: file, audioBlob: file, kind: 'audio', mimeType: file.type, durationMs: 0 }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Recorder } from '@/components/recorder/Recorder';
import { fakeDeps } from './_fakes';

const record = async (deps: ReturnType<typeof fakeDeps>, ms = 3000) => {
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(ms);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
};

it('records, previews, and submits once', async () => {
  const deps = fakeDeps();
  const onSubmit = vi.fn();
  render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} deps={deps} />);
  await record(deps);
  const submit = await screen.findByRole('button', { name: 'Get my score' });
  expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
  await userEvent.dblClick(submit);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ kind: 'audio', durationMs: 3000 });
});
it('locks the submit button while the parent is busy', async () => {
  const deps = fakeDeps();
  const onSubmit = vi.fn();
  const { rerender } = render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} deps={deps} />);
  await record(deps);
  await screen.findByRole('button', { name: 'Get my score' });
  rerender(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} deps={deps} busy busyLabel="Listening…" />);
  expect(screen.getByRole('button', { name: 'Listening…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retake' })).toBeDisabled();
});
it('offers Voice and Video only when both modes are allowed', () => {
  const { rerender } = render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={vi.fn()} deps={fakeDeps()} />);
  expect(screen.queryByRole('radio', { name: 'Video' })).toBeNull();
  rerender(<Recorder modes={['audio', 'video']} submitLabel="Send answer" onSubmit={vi.fn()} deps={fakeDeps()} />);
  expect(screen.getByRole('radio', { name: 'Voice' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Video' })).toBeInTheDocument();
});
it('gives a way forward when the microphone is unavailable', async () => {
  const onSubmit = vi.fn();
  render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} allowUpload deps={fakeDeps({ getUserMedia: async () => { throw new DOMException('no', 'NotAllowedError'); } })} />);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access is off.');
  const file = new File([new Uint8Array(100)], 'voice.m4a', { type: 'audio/mp4' });
  await userEvent.upload(screen.getByLabelText('Upload a voice file'), file);
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ blob: file, kind: 'audio', durationMs: 0 })));
});
it('hides the upload control unless allowed', () => {
  render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={vi.fn()} deps={fakeDeps()} />);
  expect(screen.queryByLabelText('Upload a voice file')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** The preview is an `<audio controls>` or `<video controls playsInline>` on an object URL that is revoked on retake and unmount. Video preview during recording shows the live stream muted. The timer and status text sit in an `aria-live="polite"` region. After `onSubmit` fires, further taps do nothing until `Retake`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/components/recorder tests/ui/recorder.test.tsx && git commit -m "feat: Recorder component"`

---

### Task 5: Score card and error wording

**Files:**
- Create: `src/lib/ui/error-copy.ts`, `src/components/mission/ScoreCard.tsx`
- Test: `tests/ui/score-card.test.tsx`

**Interfaces:**
- Produces:

```tsx
export function errorCopy(code: ApiErrorCode | 'undecodable' | 'too_short'): string;  // spec 4.11; 'undecodable' uses the audio_invalid wording; 'too_short' is "That was too short. Speak for at least a second."; unauthenticated returns ''
export function ScoreCard(props: { result: AttemptResult; mission: Mission; onRetry(): void; nextHref?: string }): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ScoreCard } from '@/components/mission/ScoreCard';
import { errorCopy } from '@/lib/ui/error-copy';
import { samples } from '../fixtures/api/samples';

const repeat = samples.missions.find((m) => m.mode === 'repeat')!;
const use = samples.missions.find((m) => m.mode === 'use')!;
const result = (over: object = {}, score: object = {}) => ({ ...samples.attemptResult, ...over, attempt: { ...samples.attemptResult.attempt, ...over, score: { ...samples.attemptResult.attempt.score, overall: 88, pronunciation: 84, accuracy: 96, usage: 88, heard: '아이스 아메리카노 한 잔 주세요', issues: [{ segment: '잔', problem: 'The final ㄴ was soft.', tip: 'Touch the tongue tip behind your teeth.' }], praise: 'Clear and confident.', nextTip: 'Try natural speed.', scoredBy: 'ai', ...score } } });

it('shows the score, the three bars, what was heard, and the feedback', () => {
  render(<ScoreCard result={result({ pointsAwarded: 10 })} mission={repeat} onRetry={vi.fn()} nextHref="/app" />);
  expect(screen.getByText('88')).toBeInTheDocument();
  for (const name of ['Pronunciation', 'Accuracy', 'Naturalness']) expect(screen.getByRole('meter', { name })).toBeInTheDocument();
  expect(screen.getByText('아이스 아메리카노 한 잔 주세요')).toHaveAttribute('lang', 'ko');
  expect(screen.getByText('The final ㄴ was soft.')).toBeInTheDocument();
  expect(screen.getByText('Touch the tongue tip behind your teeth.')).toBeInTheDocument();
  expect(screen.getByText('Clear and confident.')).toBeInTheDocument();
  expect(screen.getByText('+10 points')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Next mission' })).toHaveAttribute('href', '/app');
  expect(screen.queryByText('Demo scoring, not AI')).toBeNull();
});
it('labels the third bar Usage for use missions', () => {
  render(<ScoreCard result={result()} mission={use} onRetry={vi.fn()} />);
  expect(screen.getByRole('meter', { name: 'Usage' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Next mission' })).toBeNull();
});
it('explains a zero-point attempt and flags mock scoring', () => {
  render(<ScoreCard result={result({ pointsAwarded: 0 }, { overall: 42, scoredBy: 'mock' })} mission={repeat} onRetry={vi.fn()} />);
  expect(screen.getByText('No points this time. Scores of 50 and above earn points.')).toBeInTheDocument();
  expect(screen.getByText('Demo scoring, not AI')).toBeInTheDocument();
});
it('has wording for every error code', () => {
  expect(errorCopy('no_speech')).toBe("We couldn't hear any Korean. Move closer to the mic and try again.");
  expect(errorCopy('daily_limit')).toBe("You've reached today's practice limit. Come back tomorrow!");
  expect(errorCopy('budget_exhausted')).toBe('HanLog is resting for today. Too many learners at once. Try again tomorrow.');
  expect(errorCopy('scoring_failed')).toBe("That didn't score yet. Try again.");
  expect(errorCopy('content_rejected')).toBe('Please rephrase that. We keep HanLog friendly for everyone.');
  expect(errorCopy('undecodable')).toBe("That recording didn't work. Please record again.");
  expect(errorCopy('conflict')).toBe('This answer has already been rated.');
  expect(errorCopy('unauthenticated')).toBe('');
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** Layout per spec section 4.5: the overall number is the headline; the points line sits in a `MarginRow` whose marker is filled when points were awarded; a zero-point attempt that still has `pointsAwarded: 0` but overall 50 or more (already paid) shows `Already earned for this mission.` instead of the "No points" line.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 4 tests.
- [ ] **Step 5: Commit.** `git add src/lib/ui/error-copy.ts src/components/mission tests/ui/score-card.test.tsx && git commit -m "feat: score card and error wording"`

---

### Task 6: Session provider, app shell, onboarding

**Files:**
- Create: `src/lib/ui/session-context.tsx`, `src/lib/ui/use-api.ts`, `src/components/ui/AppShell.tsx`, `src/app/app/layout.tsx`, `src/app/app/onboarding/page.tsx`
- Test: `tests/ui/session.test.tsx`

**Interfaces:**
- Produces:

```tsx
export function safeNext(next: string | null): string;   // returns next only if it starts with "/app" or "/c/" and not with "//"; otherwise "/app"
export function SessionProvider(props: { children: ReactNode }): JSX.Element; // loads the session; no user and not on onboarding → router.replace('/app/onboarding?next=' + encodeURIComponent(pathname))
export function useSession(): { user: User; balance: number | null; setUser(user: User): void; refreshBalance(): Promise<void> };
export function useApi<T>(load: () => Promise<T>, deps: unknown[]): { data: T | null; error: ApiClientError | null; loading: boolean; reload(): void }; // an 'unauthenticated' error redirects to onboarding
export function AppShell(props: { children: ReactNode }): JSX.Element; // wordmark, PointsChip, nav: Missions /app, Challenges /app/challenges, Rewards /app/rewards, Me /app/me, with aria-current on the active item
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));

import Onboarding from '@/app/app/onboarding/page';
import { AppShell } from '@/components/ui/AppShell';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider, safeNext, useSession } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';

beforeEach(resetMocks);
const Who = () => <p>Hello {useSession().user.nickname}</p>;

it('only follows safe next paths', () => {
  expect(safeNext('/app/challenges/abc')).toBe('/app/challenges/abc');
  expect(safeNext('/c/ABC234')).toBe('/c/ABC234');
  for (const bad of [null, '', 'https://evil.example', '//evil.example', '/api/session', '/apple', 'javascript:alert(1)']) expect(safeNext(bad)).toBe('/app');
});
it('sends a visitor to onboarding and remembers where they were going', async () => {
  mockApi.getSession.mockResolvedValue(null);
  nav.pathname = '/app/challenges/abc';
  render(<SessionProvider><Who /></SessionProvider>);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fapp%2Fchallenges%2Fabc'));
  expect(screen.queryByText(/Hello/)).toBeNull();
});
it('renders the app for a signed-in user with balance and navigation', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValue({ balance: 120, events: [] });
  nav.pathname = '/app/rewards';
  render(<SessionProvider><AppShell><Who /></AppShell></SessionProvider>);
  expect(await screen.findByText(`Hello ${samples.user.nickname}`)).toBeInTheDocument();
  expect(await screen.findByText('★ 120 points')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Rewards' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining(['/app', '/app/challenges', '/app/rewards', '/app/me']));
});
it('onboards with nickname, role, and consent', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  nav.pathname = '/app/onboarding';
  nav.search = new URLSearchParams('next=/c/ABC234');
  render(<SessionProvider><Onboarding /></SessionProvider>);
  const start = await screen.findByRole('button', { name: 'Start' });
  expect(start).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Nickname'), 'Aisha');
  await userEvent.click(screen.getByRole('radio', { name: /I'm learning Korean/ }));
  expect(start).toBeDisabled();                                   // consent still missing
  await userEvent.click(screen.getByRole('checkbox', { name: /I agree that my voice recordings are sent to OpenAI/ }));
  await userEvent.click(start);
  expect(mockApi.createSession).toHaveBeenCalledWith({ nickname: 'Aisha', role: 'learner' });
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/c/ABC234'));
});
it('shows the server reason when a nickname is rejected', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockRejectedValue(new ApiClientError('content_rejected', 422, 'x'));
  nav.pathname = '/app/onboarding';
  render(<SessionProvider><Onboarding /></SessionProvider>);
  await userEvent.type(await screen.findByLabelText('Nickname'), 'Aisha');
  await userEvent.click(screen.getByRole('radio', { name: /I speak Korean/ }));
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please rephrase that. We keep HanLog friendly for everyone.');
  expect(nav.replace).not.toHaveBeenCalledWith('/app');
});
```

If the foundation's `ApiClientError` constructor has a different argument order, adapt the test's constructor call, not the class.

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement.** Onboarding text is spec section 4.2 and the consent text is spec section 12, word for word, with a link to `/privacy`. A signed-in user who opens onboarding is sent to `safeNext(next)`. `src/app/app/layout.tsx` wraps children in `SessionProvider` and `AppShell`; the shell hides its navigation on the onboarding path. Bottom navigation on phones, header navigation from 768 px.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/lib/ui src/components/ui/AppShell.tsx src/app/app tests/ui/session.test.tsx && git commit -m "feat: session provider, app shell, onboarding"`

---

### Task 7: Home screen

**Files:**
- Modify: `src/app/app/page.tsx`
- Create: `src/components/mission/MissionRow.tsx`
- Test: `tests/ui/home.test.tsx`

**Interfaces:**
- Produces: `MissionRow(props: { mission: MissionWithProgress })`: a link to `/app/missions/<id>` showing the Korean text, the meaning, and either `Best 88` or `New`.

- [ ] **Step 1: Write the failing test**

Every page test from here on starts with the two `vi.mock` lines and `beforeEach(resetMocks)` from the Global Constraints, and renders the page inside `<SessionProvider>` after `mockApi.getSession.mockResolvedValue(...)` and `mockApi.getPoints.mockResolvedValue({ balance: 0, events: [] })`. That preamble is not repeated below.

```tsx
it("shows today's three missions and all missions grouped by level", async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.listMissions.mockResolvedValue({ missions: samples.missions, today: samples.missions.slice(0, 3).map((m) => m.id) });
  render(<SessionProvider><Home /></SessionProvider>);
  expect(await screen.findByText(`안녕하세요, ${samples.user.nickname}`)).toBeInTheDocument();
  const today = within(screen.getByRole('region', { name: "Today's missions" }));
  expect(today.getAllByRole('link')).toHaveLength(3);
  expect(screen.getByRole('heading', { name: 'Level 1' })).toBeInTheDocument();
  const first = samples.missions[0];
  expect(screen.getAllByRole('link', { name: new RegExp(first.meaningEn) })[0]).toHaveAttribute('href', `/app/missions/${first.id}`);
  expect(screen.queryByText('Post a challenge')).toBeNull();
});
it('puts the peer block first for a Korean speaker', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.listMissions.mockResolvedValue({ missions: samples.missions, today: [] });
  mockApi.listChallenges.mockResolvedValue([{ ...samples.challenge, viewer: { responded: false, pendingToRate: 2 } }]);
  render(<SessionProvider><Home /></SessionProvider>);
  expect(await screen.findByText('2 answers waiting for your rating')).toBeInTheDocument();
  expect(mockApi.listChallenges).toHaveBeenCalledWith('to-rate');
  expect(screen.getByRole('link', { name: 'Post a challenge' })).toHaveAttribute('href', '/app/challenges/new');
});
it('offers a retry when loading fails', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.listMissions.mockRejectedValueOnce(new ApiClientError('internal', 500, 'x')).mockResolvedValueOnce({ missions: samples.missions, today: [] });
  render(<SessionProvider><Home /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Level 1' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** per spec section 4.4. "Today's missions" and "All missions" are each a `<section>` labelled by its heading. The waiting count is the sum of `viewer.pendingToRate`; with zero waiting the line reads `No answers waiting right now.`
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Commit.** `git add src/app/app/page.tsx src/components/mission/MissionRow.tsx tests/ui/home.test.tsx && git commit -m "feat: home screen"`

---

### Task 8: Mission flow and mission screen

**Files:**
- Create: `src/components/mission/MissionFlow.tsx`, `src/app/app/missions/[id]/page.tsx`
- Test: `tests/ui/mission-flow.test.tsx`

**Interfaces:**
- Consumes: `Recorder`, `RecorderResult`, `blobToScoringWav`, `ConvertError`, `ScoreCard`, `errorCopy`, `api.submitAttempt`.
- Produces:

```tsx
export function MissionFlow(props: {
  mission: Mission;
  nextHref?: string;
  onScored?(result: AttemptResult): void;
  convert?: (blob: Blob) => Promise<Uint8Array>;   // default blobToScoringWav
  deps?: Partial<RecorderDeps>;
}): JSX.Element;
```

`MissionFlow` shows the mission content (spec section 4.5), then the recorder with `modes={['audio', 'video']}`, `allowUpload`, `submitLabel="Get my score"`, `busyLabel="Listening…"`. On submit it converts `result.audioBlob`, calls `api.submitAttempt(mission.id, wav)`, and shows `ScoreCard`. It does not use `useSession`, so the introduction page can reuse it.

- [ ] **Step 1: Write the failing test**

```tsx
const mission = samples.missions.find((m) => m.mode === 'repeat')!;
const convert = vi.fn(async () => toneWav(1000));
const recordAndSubmit = async (deps: ReturnType<typeof fakeDeps>) => {
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
};

it('shows the mission with romanization hidden until asked', async () => {
  render(<MissionFlow mission={mission} convert={convert} deps={fakeDeps()} />);
  expect(screen.getByText(mission.korean)).toHaveAttribute('lang', 'ko');
  expect(screen.getByText(mission.meaningEn)).toBeInTheDocument();
  expect(screen.getByText('Where to say it')).toBeInTheDocument();
  expect(screen.getByText(mission.situationEn)).toBeInTheDocument();
  expect(screen.queryByText(mission.romanization)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Show romanization' }));
  expect(screen.getByText(mission.romanization)).toBeInTheDocument();
});
it('records, converts, submits once, and shows the score', async () => {
  let release!: (value: AttemptResult) => void;
  mockApi.submitAttempt.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  const onScored = vi.fn();
  const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={convert} deps={deps} onScored={onScored} />);
  await recordAndSubmit(deps);
  const waiting = await screen.findByRole('button', { name: 'Listening…' });
  await userEvent.click(waiting);                                   // a second tap during the wait
  expect(mockApi.submitAttempt).toHaveBeenCalledTimes(1);
  expect(mockApi.submitAttempt).toHaveBeenCalledWith(mission.id, expect.any(Uint8Array));
  release(samples.attemptResult);
  expect(await screen.findByRole('meter', { name: 'Pronunciation' })).toBeInTheDocument();
  expect(onScored).toHaveBeenCalledWith(samples.attemptResult);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
});
it('keeps the recording and explains when nothing was heard', async () => {
  mockApi.submitAttempt.mockRejectedValue(new ApiClientError('no_speech', 422, 'x'));
  const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={convert} deps={deps} />);
  await recordAndSubmit(deps);
  expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't hear any Korean. Move closer to the mic and try again.");
  expect(screen.getByRole('button', { name: 'Get my score' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
});
it('explains a recording the browser cannot convert, without calling the server', async () => {
  const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={async () => { throw new ConvertError('undecodable'); }} deps={deps} />);
  await recordAndSubmit(deps);
  expect(await screen.findByRole('alert')).toHaveTextContent("That recording didn't work. Please record again.");
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});
it('plays the reference clip, labelled as an AI voice, only when there is one', () => {
  const { rerender } = render(<MissionFlow mission={{ ...mission, referenceAudio: null }} convert={convert} deps={fakeDeps()} />);
  expect(screen.queryByRole('button', { name: /Listen/ })).toBeNull();
  rerender(<MissionFlow mission={{ ...mission, referenceAudio: '/audio/missions/x.mp3' }} convert={convert} deps={fakeDeps()} />);
  expect(screen.getByRole('button', { name: /Listen/ })).toBeInTheDocument();
  expect(screen.getByText('AI voice')).toBeInTheDocument();
});
```

Adapt the `ConvertError` constructor call to the class as written in task 2.

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement `MissionFlow` and the page.** The page reads `id` from `useParams`, finds the mission in `api.listMissions()`, renders `MissionFlow` with `nextHref` pointing to the next mission in list order (or `/app` after the last), and calls `refreshBalance()` from `onScored`. Unknown id shows `We couldn't find that.` with a link to `/app`. A `daily_limit`, `budget_exhausted`, or other error shows `errorCopy(code)`; `unauthenticated` redirects to onboarding.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 5 tests.
- [ ] **Step 5: Commit.** `git add src/components/mission/MissionFlow.tsx "src/app/app/missions" tests/ui/mission-flow.test.tsx && git commit -m "feat: mission flow from recording to score"`

---

### Task 9: Rewards screen

**Files:**
- Create: `src/app/app/rewards/page.tsx`
- Test: `tests/ui/rewards.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('shows balance, example coupons with progress, and history', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValue({ balance: 450, events: [
    { id: 'e2', delta: 27, reason: 'peer_response', label: 'Your answer was rated', createdAt: '2026-11-15T03:00:00.000Z' },
    { id: 'e1', delta: 10, reason: 'mission', label: 'Mission: 만나서 반갑습니다.', createdAt: '2026-11-14T03:00:00.000Z' },
  ] });
  mockApi.listRewards.mockResolvedValue(samples.rewards);
  render(<SessionProvider><Rewards /></SessionProvider>);
  expect(await screen.findByText('450')).toBeInTheDocument();
  expect(screen.getByText('Example rewards. Partners are not confirmed yet.')).toBeInTheDocument();
  const cafe = within(screen.getByRole('article', { name: 'Café drink coupon' }));
  expect(cafe.getByText('400 points')).toBeInTheDocument();
  expect(cafe.getByRole('button', { name: 'Coming soon' })).toBeDisabled();
  expect(cafe.getByText('You have enough points')).toBeInTheDocument();
  const album = within(screen.getByRole('article', { name: 'K-pop album voucher' }));
  expect(album.getByText('2,550 points to go')).toBeInTheDocument();
  expect(screen.getByText('+27')).toBeInTheDocument();
  expect(screen.getByText('Your answer was rated')).toBeInTheDocument();
});
it('invites a first mission when there is no history', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValue({ balance: 0, events: [] });
  mockApi.listRewards.mockResolvedValue(samples.rewards);
  render(<SessionProvider><Rewards /></SessionProvider>);
  expect(await screen.findByText('No points yet. Your first mission is waiting.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to missions' })).toHaveAttribute('href', '/app');
});
```

`samples.rewards` must contain the six catalog items from spec section 13; if the foundation fixture differs, use the titles it has and keep the arithmetic consistent.

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** per spec section 4.9. "How points work" is three lines: missions pay up to their level's points once (10, 20, 30); answers earn when rated; rating and feedback earn too. Dates use `Intl.DateTimeFormat` in the visitor's locale.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 2 tests.
- [ ] **Step 5: Commit.** `git add src/app/app/rewards tests/ui/rewards.test.tsx && git commit -m "feat: rewards screen"`

---

### Task 10: Challenges board

**Files:**
- Create: `src/app/app/challenges/page.tsx`, `src/components/challenge/ChallengeRow.tsx`
- Test: `tests/ui/challenges.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('shows a learner the open challenges and their answers', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.listChallenges.mockImplementation(async (scope: string) => scope === 'open'
    ? [samples.challenge, { ...samples.challenge, id: 'c2', korean: '나 요즘 갓생 살고 있어.', viewer: { responded: true, pendingToRate: 0 } }]
    : scope === 'answered' ? [{ ...samples.challenge, id: 'c2', korean: '나 요즘 갓생 살고 있어.', viewer: { responded: true, pendingToRate: 0 } }] : []);
  render(<SessionProvider><Challenges /></SessionProvider>);
  const open = within(await screen.findByRole('region', { name: 'Open challenges' }));
  expect(open.getAllByRole('link')).toHaveLength(2);
  expect(open.getByText('Answered')).toBeInTheDocument();
  expect(open.getAllByRole('link')[0]).toHaveAttribute('href', `/app/challenges/${samples.challenge.id}`);
  expect(within(screen.getByRole('region', { name: 'My answers' })).getAllByRole('link')).toHaveLength(1);
  expect(mockApi.listChallenges.mock.calls.map((c) => c[0]).sort()).toEqual(['answered', 'open']);
  expect(screen.queryByRole('link', { name: 'Post a challenge' })).toBeNull();
});
it('shows a Korean speaker what to rate, their own challenges, and the post button', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.listChallenges.mockImplementation(async (scope: string) => scope === 'to-rate' ? [{ ...samples.challenge, viewer: { responded: false, pendingToRate: 3 } }] : []);
  render(<SessionProvider><Challenges /></SessionProvider>);
  expect(await screen.findByRole('heading', { name: 'To rate (3)' })).toBeInTheDocument();
  expect(screen.getByText('You have not posted a challenge yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Post a challenge' })).toHaveAttribute('href', '/app/challenges/new');
  expect(mockApi.listChallenges.mock.calls.map((c) => c[0]).sort()).toEqual(['mine', 'to-rate']);
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** per spec section 4.6. Each list is a `<section>` labelled by its heading, so the regions are named `Open challenges`, `My answers`, `To rate (n)`, and `My challenges`. Empty states: open list `No open challenges yet. Check back soon.`; my answers `You have not answered a challenge yet.`; to rate `Nothing to rate right now.`; mine `You have not posted a challenge yet.` Each row shows the Korean text, the meaning, the author nickname, and for sample challenges a small `Sample` badge.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 2 tests.
- [ ] **Step 5: Commit.** `git add src/app/app/challenges/page.tsx src/components/challenge tests/ui/challenges.test.tsx && git commit -m "feat: challenges board"`

---

### Task 11: Post a challenge

**Files:**
- Create: `src/app/app/challenges/new/page.tsx`, `src/components/challenge/SharePanel.tsx`
- Test: `tests/ui/challenge-new.test.tsx`

**Interfaces:**
- Produces: `SharePanel(props: { code: string; origin?: string })`: shows the code, the link `<origin>/c/<code>`, a `Copy link` button (`navigator.clipboard.writeText`, then the label becomes `Copied`), and a `Share` button only when `navigator.share` exists.

- [ ] **Step 1: Write the failing test**

```tsx
it('posts a challenge and then shows how to share it', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.createChallenge.mockResolvedValue({ ...samples.challenge, code: 'ABC234' });
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<SessionProvider><NewChallenge /></SessionProvider>);
  const post = await screen.findByRole('button', { name: 'Post challenge' });
  expect(post).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Korean expression'), 'jeommechu');
  await userEvent.type(screen.getByLabelText('Meaning in English'), 'Recommend a lunch menu.');
  expect(screen.getByText('Write the expression in Hangul.')).toBeInTheDocument();
  expect(post).toBeDisabled();
  await userEvent.clear(screen.getByLabelText('Korean expression'));
  await userEvent.type(screen.getByLabelText('Korean expression'), '오늘 점메추 좀 해 줘.');
  await userEvent.click(post);
  expect(mockApi.createChallenge).toHaveBeenCalledWith({ korean: '오늘 점메추 좀 해 줘.', meaningEn: 'Recommend a lunch menu.', situationEn: '' });
  expect(await screen.findByText('ABC234')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/c\/ABC234$/));
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
});
it('turns learners away', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  render(<SessionProvider><NewChallenge /></SessionProvider>);
  expect(await screen.findByText('Only Korean speakers can post challenges. You can switch your role on the Me screen.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Korean expression')).toBeNull();
});
it('shows the server reason and keeps what was typed', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.createChallenge.mockRejectedValue(new ApiClientError('content_rejected', 422, 'x'));
  render(<SessionProvider><NewChallenge /></SessionProvider>);
  await userEvent.type(await screen.findByLabelText('Korean expression'), '대박');
  await userEvent.type(screen.getByLabelText('Meaning in English'), 'Wow');
  await userEvent.click(screen.getByRole('button', { name: 'Post challenge' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please rephrase that.');
  expect(screen.getByLabelText('Korean expression')).toHaveValue('대박');
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** per spec section 4.7. Field labels: `Korean expression`, `Meaning in English`, `Situation or example (optional)`. Counters use the limits from `LIMITS`. The optional reference recording uses `Recorder` with `modes={['audio']}`, `submitLabel="Use this recording"`; when present it is passed as `media: { blob, durationMs }`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 3 tests.
- [ ] **Step 5: Commit.** `git add src/app/app/challenges/new src/components/challenge/SharePanel.tsx tests/ui/challenge-new.test.tsx && git commit -m "feat: post a challenge and share it"`

---

### Task 12: Challenge detail

**Files:**
- Create: `src/app/app/challenges/[id]/page.tsx`, `src/components/challenge/{MediaPlayer,AnswerPanel,RatingForm,FeedbackForm,ResponseCard}.tsx`
- Test: `tests/ui/challenge-detail.test.tsx`

**Interfaces:**
- Produces: `MediaPlayer(props: { url: string; kind: MediaKind; label: string })`: a `Play` button that calls `api.fetchMediaBlobUrl(url)` on first tap, then renders `<audio>` or `<video>` with controls on the blob URL; revokes the URL on unmount and when `url` changes; on failure shows `This recording is no longer available.`

- [ ] **Step 1: Write the failing test**

```tsx
const pending = samples.response;                      // status 'pending'
const rated = samples.ratedResponse;                   // status 'rated', feedback null

it('lets a learner answer with voice or video', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForLearner, viewerRole: 'visitor', myResponse: null });
  mockApi.submitResponse.mockResolvedValue(pending);
  nav.params = { id: samples.challenge.id };
  const deps = fakeDeps();
  render(<SessionProvider><ChallengeDetailPage recorderDeps={deps} /></SessionProvider>);
  expect(await screen.findByText(samples.challenge.korean)).toHaveAttribute('lang', 'ko');
  expect(screen.getByRole('radio', { name: 'Video' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(4000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Send answer' }));
  expect(mockApi.submitResponse).toHaveBeenCalledWith(samples.challenge.id, expect.objectContaining({ kind: 'audio', durationMs: 4000 }));
  expect(await screen.findByText(`Sent. ${samples.challenge.author.nickname} will rate it.`)).toBeInTheDocument();
});
it('shows a responder the rating and takes feedback once', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForLearner, viewerRole: 'responder', myResponse: rated });
  mockApi.giveFeedback.mockResolvedValue({ ...rated, feedback: { helpfulness: 5, comment: 'Thanks!', givenAt: '2026-11-15T04:00:00.000Z' } });
  nav.params = { id: samples.challenge.id };
  render(<SessionProvider><ChallengeDetailPage /></SessionProvider>);
  expect(await screen.findByRole('img', { name: `Pronunciation: ${rated.rating!.pronunciation} out of 5` })).toBeInTheDocument();
  expect(screen.getByText(rated.rating!.comment)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
  await userEvent.type(screen.getByLabelText('Comment (optional)'), 'Thanks!');
  await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  expect(mockApi.giveFeedback).toHaveBeenCalledWith(rated.id, { helpfulness: 5, comment: 'Thanks!' });
  expect(await screen.findByText('Thanks. Your feedback was sent.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send feedback' })).toBeNull();
});
it('lets the author play and rate each waiting answer', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForAuthor, viewerRole: 'author', responses: [pending] });
  mockApi.mediaUrl.response.mockReturnValue(`/api/responses/${pending.id}/media`);
  mockApi.fetchMediaBlobUrl.mockResolvedValue('blob:one');
  mockApi.rateResponse.mockResolvedValue({ ...rated, id: pending.id });
  nav.params = { id: samples.challenge.id };
  render(<SessionProvider><ChallengeDetailPage /></SessionProvider>);
  const card = within(await screen.findByRole('article', { name: `Answer from ${pending.responder.nickname}` }));
  const submit = card.getByRole('button', { name: 'Send rating' });
  expect(submit).toBeDisabled();
  await userEvent.click(card.getByRole('button', { name: 'Play' }));
  expect(mockApi.fetchMediaBlobUrl).toHaveBeenCalledWith(`/api/responses/${pending.id}/media`);
  await userEvent.click(within(card.getByRole('radiogroup', { name: 'Pronunciation' })).getByRole('radio', { name: '4 stars' }));
  await userEvent.click(within(card.getByRole('radiogroup', { name: 'Naturalness' })).getByRole('radio', { name: '5 stars' }));
  await userEvent.click(submit);
  expect(mockApi.rateResponse).toHaveBeenCalledWith(pending.id, { pronunciation: 4, naturalness: 5, comment: '' });
  expect(await card.findByText('Rated. Thank you.')).toBeInTheDocument();
});
it('reports an answer after a confirmation', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForAuthor, viewerRole: 'rater', responses: [pending] });
  mockApi.reportResponse.mockResolvedValue(undefined);
  nav.params = { id: samples.challenge.id };
  render(<SessionProvider><ChallengeDetailPage /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Report' }));
  await userEvent.click(screen.getByRole('button', { name: 'Yes, report it' }));
  expect(mockApi.reportResponse).toHaveBeenCalledWith(pending.id);
  await waitFor(() => expect(screen.queryByRole('article', { name: `Answer from ${pending.responder.nickname}` })).toBeNull());
});
it('revokes the playback URL when the player goes away', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mockApi.fetchMediaBlobUrl.mockResolvedValue('blob:two');
  const { unmount } = render(<MediaPlayer url="/api/responses/r1/media" kind="audio" label="Answer" />);
  await userEvent.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:two'));
  unmount();
  expect(revoke).toHaveBeenCalledWith('blob:two');
});
it('says so when a recording has expired', async () => {
  mockApi.fetchMediaBlobUrl.mockRejectedValue(new ApiClientError('not_found', 404, 'x'));
  render(<MediaPlayer url="/api/responses/r1/media" kind="audio" label="Answer" />);
  await userEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(await screen.findByText('This recording is no longer available.')).toBeInTheDocument();
});
```

The page component accepts an optional `recorderDeps` prop for tests; the default export passes none.

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** the four viewer modes in spec section 4.8. A response with `mediaAvailable: false` shows `This recording is no longer available.` instead of a player. A Korean-role visitor on someone else's challenge sees the header and `Only the author can rate answers to this challenge.` A pending responder sees `Waiting for a rating.` plus a `Record again` button that reopens the recorder. Errors use `errorCopy`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 6 tests.
- [ ] **Step 5: Commit.** `git add "src/app/app/challenges/[id]" src/components/challenge tests/ui/challenge-detail.test.tsx && git commit -m "feat: challenge detail for learners, authors, and raters"`

---

### Task 13: Me screen and share-link page

**Files:**
- Create: `src/app/app/me/page.tsx`, `src/app/c/[code]/page.tsx`
- Test: `tests/ui/me.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('edits the nickname and switches role', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.updateSession.mockImplementation(async (patch: object) => ({ ...samples.user, ...patch }));
  render(<SessionProvider><Me /></SessionProvider>);
  const input = await screen.findByLabelText('Nickname');
  await userEvent.clear(input);
  await userEvent.type(input, 'Aisha K');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(mockApi.updateSession).toHaveBeenCalledWith({ nickname: 'Aisha K' });
  expect(await screen.findByText('Saved.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: /I speak Korean/ }));
  expect(mockApi.updateSession).toHaveBeenLastCalledWith({ role: 'korean' });
});
it('deletes everything only after a second confirmation', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.deleteSession.mockResolvedValue(undefined);
  render(<SessionProvider><Me /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete my data' }));
  expect(mockApi.deleteSession).not.toHaveBeenCalled();
  expect(screen.getByText('This removes your nickname, scores, points, challenges, answers, and stored recordings. It cannot be undone.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
  expect(mockApi.deleteSession).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
});
it('follows a share code to the challenge, or says the link is not valid', async () => {
  mockApi.getChallenge.mockResolvedValueOnce(samples.challengeDetailForLearner);
  nav.params = { code: 'abc234' };
  const first = render(<ShareLink />);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/app/challenges/${samples.challenge.id}`));
  expect(mockApi.getChallenge).toHaveBeenCalledWith('abc234');
  first.unmount();
  mockApi.getChallenge.mockRejectedValueOnce(new ApiClientError('not_found', 404, 'x'));
  render(<ShareLink />);
  expect(await screen.findByText('This challenge link is not valid.')).toBeInTheDocument();
});
it('sends a visitor with a share link through onboarding and back', async () => {
  mockApi.getChallenge.mockRejectedValueOnce(new ApiClientError('unauthenticated', 401, 'x'));
  nav.params = { code: 'ABC234' };
  render(<ShareLink />);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fc%2FABC234'));
});
```

- [ ] **Step 2: Run to verify it fails.** Expected: FAIL.
- [ ] **Step 3: Implement** per spec section 4.10. The Me screen also links to `/privacy`. The confirmation is a native `<dialog>`.
- [ ] **Step 4: Run to verify it passes.** Expected: PASS, 4 tests.
- [ ] **Step 5: Commit.** `git add src/app/app/me src/app/c tests/ui/me.test.tsx && git commit -m "feat: profile screen and share-link page"`

---

### Task 14: Look at it, then hand off

**Files:**
- Create: `docs/handoffs/frontend.md`

- [ ] **Step 1: Run the whole suite and a build**

Run: `npm run check && npm run build`
Expected: PASS; the build lists `/app`, `/app/onboarding`, `/app/missions/[id]`, `/app/challenges`, `/app/challenges/new`, `/app/challenges/[id]`, `/app/rewards`, `/app/me`, `/c/[code]`.

- [ ] **Step 2: Walk every screen in a browser at 390 px, 320 px, and 1440 px**

Run `npm run dev` and open each route. If the backend branch is not merged yet, the API routes are missing; in that case rebase on `main` once backend lands and repeat this step before handing off. For each screen and width check: no horizontal scrolling; one clear primary action; one corner mark at most; Korean text wraps without clipping; focus ring visible on every control when tabbing; tapping Record asks for the microphone and the mock score appears.

- [ ] **Step 3: Check the screens against `docs/design/open-window/DESIGN.md` section "Review before implementation"** and fix what fails.

- [ ] **Step 4: Write `docs/handoffs/frontend.md` and commit**

List each screen with its test file, what you verified by hand and at which widths, anything the design left open that you decided, and requests to other workstreams.

```bash
git add -A && git commit -m "docs: frontend handoff"
```
