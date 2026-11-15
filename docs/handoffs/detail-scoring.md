# Scoring and content detail review

Review scope: scoring parsing/composition, evaluation evidence, generation budgets and content consistency. No paid API request, secret read, native-speaker sign-off or pronunciation calibration is part of this pass.

## Fixed findings

1. The score parser took the first score even when multiple tool calls or choices were returned, or when the completion was marked incomplete/refused. These responses must fail rather than award points.
2. The Hangul normalizer discarded canonically decomposed Korean, making an otherwise identical transcript appear to contain no matching syllables.
3. Evaluation completion ignored skipped human calibration. Incomplete early results could also hide an observed failure, and dry-run preflight did not validate existing WAV contents.
4. Reference generation had no explicit request budget and continued across the catalog after service errors. Live generation must require a finite budget, count every attempt and stop when the service fails or the budget is exhausted.
5. The content review table omitted the actual romanization values it asked reviewers to check. The 소확행 entry used a pronunciation-oriented spelling instead of the Revised Romanization noun-boundary convention.

## Scope limits

The existing no-speech, jamo mismatch and required-keyword rules remain authoritative; no score weights or thresholds are changed. Regression coverage for transcribed English/Korean score requests does not establish live prompt-injection resistance: if a model fabricates the target transcript, deterministic transcript checks cannot recover what was actually spoken. That is why A2/A7 and the conditional independent-transcription fallback remain live evaluation questions.

The saved cafe WAV is synthetic and its single scorer heard 아이씨 where the target says 아이스. WAV validity is not independent verification of the spoken content. It is not published as a reference clip, and referenceAudio stays null. All native content reviews and five consented human calibration pairs remain pending.

## Sources

- [OpenAI Chat Completions response contract](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create): choices, tool calls, refusal and completion finish reasons.
- [National Institute of Korean Language romanization rules](https://www.korean.go.kr/front_eng/roman/roman_01.do): section 3 preserves h when it follows k/t/p within nouns. Applying that rule to 소확행 gives sohwakhaeng; this is a rule-based correction, not native-speaker approval.

## Operation and validation

Reference generation still defaults to dry-run. Live mode now requires an explicit `--max-calls` value covering at least two requests per selected mission (synthesis and independent transcription); a second voice needs two more. `--only` narrows the batch. Every network attempt consumes this budget, and the batch stops at the first failed generation, verification or exhausted budget. It reports actual request attempts and whether it stopped early. It no longer reads `.env.local` automatically.

Evaluation dry-run checks mission ids, duplicate entries, WAV format/duration and signal level, then reports each ready/missing/invalid file. A format-valid clip is explicitly not a verified transcript. Missing human calibration and missing ten-second latency audio are visible before any paid run. A live run's exit status and saved `acceptanceComplete` field require every named acceptance check to pass; SKIP is not success.

The initial targeted regression run failed ten tests. After the fixes, scoring/content/moderation tests passed: 86 tests and one deliberately skipped live test, using two workers. Both diagnostic dry-runs made zero requests. They report the existing cafe/noise WAVs as format-valid, eight missing speech recordings, absent human calibration and absent ten-second latency evidence. No published reference clip or acceptance result was created.

After merging dependency checkpoint `dd03858`, the full `npm run check` passed TypeScript, ESLint and Vitest: 287 tests passed, three deliberately skipped, across 55 passing and two skipped files. `git diff --check` also passed.
