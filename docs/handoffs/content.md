# Content handoff

Implemented the offline portion of plan05. The owner explicitly requested very small API usage, so this workstream made **zero real API calls**.

## Catalog

| Level | Repeat | Use | Total |
| --- | ---: | ---: | ---: |
| 1 | 10 | 2 | 12 |
| 2 | 5 | 3 | 8 |
| 3 | 3 | 1 | 4 |
| Total | 18 | 6 | 24 |

Eight sample challenges (SMPL22–SMPL29) and all six unchanged rewards are present. All six seed missions and the first two sample challenges retain their original values. File order groups missions by level, with seeds retained first in each group. No reference audio is advertised: every referenceAudio remains null.

## Verification

- Observed the planned count tests fail against the six-mission/two-challenge seed.
- Content rules pass: distribution, unique ids/keywords, syllable lengths, permitted tags, code alphabet, no near-duplicate sentences, and reward prices.
- Four mocked generator tests cover zero-cost dry runs, independently verified publication, one cedar retry on transcription mismatch, and invalid inputs/key absence before requests.
- `npm run check`: 105 passing tests, typecheck and lint pass.
- `npm run content:audio -- --only cafe-iced-americano`: dry run, one planned clip, zero requests.

## Reference generator

`scripts/gen-reference-audio.ts` implements planned generation and verification, with `--only <id>` and `--force`. **Added `--live` opt-in** to honor the owner's spending limit: without it the command only previews selected clips. Live mode needs the ignored local environment key and can make up to four requests per selected mission (two voices, each independently transcribed). It publishes a clip only when jamo similarity reaches 0.9. A failed force regeneration preserves any previously verified clip.

Current official transcription documentation uses plural `languages[]=ko` for gpt-transcribe, without the target as a prompt. The script records the January 6, 2027 shutdown of gpt-4o-mini-tts; committed clips would survive that shutdown, but none were generated in this lane.

Live synthesis/transcription is **not verified** here. Scoring's separately authorized single café fixture is not a published reference clip. Bulk reference generation is deferred, rather than silently spending the key on 24 clips.

## Native review

`docs/content-review.md` contains every item, context, meaning, and a pending sign-off column in Korean/English. H3 has **not** happened. Highest-priority checks:

- 헐: close-friend register and interpretation of surprise.
- 소확행: contemporary use, example naturalness, sound-based romanization.
- Professor deadline extension: politeness and natural phrasing.
- Interview sentence: breath length and a natural spoken combination.
- 화이팅: spelling choice and natural encouragement.
- 오운완: more common as a caption/message; validate the spoken example.
- Approved 점메추/갓생 seeds: current student use and tone.
- 취향 저격: spacing and audience suitability.

The National Institute romanization rules and its 2026 discussion of 소확행 informed the drafting; links appear in the review sheet. They do not constitute native-speaker approval.

## Deviations and requests

Tasks1–3 are committed together because the complete-catalog tests intentionally fail until both content files are expanded. This keeps each delivered commit testable. Reference generation is implemented and tested offline but not executed live, per the owner's later cost constraint. No shared-file changes are requested.

UI workstreams must hide Listen when referenceAudio is null, retain the AI voice label when a clip is later provided, and keep all Hangul marked with lang="ko". QA should continue reporting H3 and reference-clip generation as pending.
