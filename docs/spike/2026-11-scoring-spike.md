# Scoring spike: limited live verification

Date: 2026-11-15. This is a **single-case compatibility check**, not completion of the A1–A7 evaluation. The owner requested very little spending, so this work made exactly **two paid requests**: one short TTS request and one scoring request. No retry, second variant, bulk fixture generation, reference clip generation, calibration, or live test followed.

## Observed result

- TTS: `gpt-4o-mini-tts`, voice `marin`, Korean cafe sentence `아이스 아메리카노 한 잔 주세요`. The returned WAV was normalized to mono 16 kHz PCM16: 94,444 bytes, 2,950 ms. This is synthetic speech, not a consented human sample.
- Scoring: `gpt-audio-1.5`, Chat Completions, text-only output, non-strict `submit_score` function with forced tool choice (plan variant V2), `max_completion_tokens: 1000`, `store: false`. HTTP 200; one request; 3,165 ms elapsed.
- Composed overall 88; pronunciation 85, accuracy 90, usage 90. The model heard `아이씨 아메리카노 한 잔 주세요` and highlighted the `스`/`씨` distinction. A native speaker has not reviewed the generated clip, so this observation does not establish whether the judgment is correct.
- Raw report: `latest-single.json`. No credentials, headers, or input audio base64 are retained in the report.

Usage: 824 input tokens (795 text, 29 audio), 145 output text tokens, 969 total. At the checked model prices of $2.50/M input text, $32/M input audio, and $10/M output text, the scoring estimate is **$0.0043655 USD**. The binary TTS response does not include token usage, so its actual charge and the two-request total are not claimed here.

## Acceptance evidence

| Check | State | Evidence still required |
| --- | --- | --- |
| A1 native score >=80 across three missions | Incomplete | One cafe case scored 88; two other missions and repeated evaluation remain |
| A2 wrong sentence <=49 and jamo similarity <0.6 | Untested live | Wrong-sentence fixture and three runs |
| A3 noise rejected as no_speech | Untested live | Locally generated noise fixture and three runs |
| A4 English-only score <=49 | Untested live | English fixture and three runs |
| A5 spread <=10 across three runs | Untested live | No repeat paid requests were made |
| A6 >=80% of five human learner/native pairs ordered correctly | Blocked on samples | Consented human samples and native review |
| A7 spoken prompt injection score <=49 | Untested live | Injection fixture and three runs |
| Use mode positive/negative cases | Untested live | Both usage fixtures and three runs each |
| Median <=6s, p95 <=12s on ten-second audio | Untested | The measured clip is only 2.95 seconds; a dedicated ten-second fixture is required |

V2 compatibility is established for this request. Strict mode and alternate output modalities were not probed because a working low-cost shape was found. No separate transcription fallback or two-pass pipeline is implemented: the limited evidence does not justify either conditional branch.

## Offline and future live operation

All three script entry points default to dry-run even when a key exists in the process environment:

```sh
npx tsx scripts/gen-fixtures.ts
npm run spike:scoring
npm run eval:scoring
```

Fixture generation defaults to the one cafe file, skips existing files, has a one-call default budget, and requires `--live`; broader generation needs `--all --max-calls <count>`. The manifest lists ten planned cases, but only the cafe WAV and deterministic local noise WAV exist. Eight speech fixtures are intentionally absent.

The single spike requires `--live` and refuses to replace an existing report without `--force`. It hard-limits itself to one scoring request, including retryable errors. The full evaluator requires `--live --max-calls <printed-count>`, validates every fixture before spending, performs three runs per fixture with retries disabled, and stops after the first service failure. Supply `--latency-file <ten-second.wav>` for the separate latency check. Human samples live under `tests/fixtures/scoring/human/` with `index.json` entries `{ file, missionId, kind: "native" | "learner" }`; obtain consent before adding recordings. The evaluator does not treat missing human samples as a pass.

The live Vitest test is skipped unless both `RUN_LIVE=1` and `OPENAI_API_KEY` are deliberately supplied. It was **not run** during this work. Production provider retries at most once for 429/500/502/503/504; diagnostic scripts and the live test explicitly disable retries.

## Official API references checked

- [Audio Chat Completions guide](https://developers.openai.com/api/docs/guides/audio-chat-completions): base64 WAV input and Chat Completions request shape.
- [gpt-audio-1.5 model](https://developers.openai.com/api/docs/models/gpt-audio-1.5): function calling support, lack of Structured Outputs support, and model prices.
- [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create): token limits and tool selection.
- [Text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech) and [gpt-4o-mini-tts model](https://developers.openai.com/api/docs/models/gpt-4o-mini-tts): WAV output, voices and pricing. This TTS model has a documented 2027-01-06 shutdown date; revisit fixture generation before using it after that date.
