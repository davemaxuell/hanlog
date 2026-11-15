# Scoring handoff

Implemented the scoring prompt, non-strict submit_score schema, plain-fetch OpenAI provider, conservative response parser, timeouts, restricted retries and privacy-safe usage logging. Shared foundation contracts and package files are unchanged.

The owner authorized only a small live check. Exactly one cafe TTS request and one scoring request succeeded; the scoring request cost estimate was $0.0043655, with TTS cost unavailable from its binary response. The provider's V2 request shape works. Full accuracy, stability, injection and latency acceptance criteria remain unverified. See `docs/spike/2026-11-scoring-spike.md` and `latest-single.json` for evidence and limits.

Plan state:

- Task 1: safe fixture/spike scripts complete; one-case compatibility observed. Full fixture set and A1–A7 evaluation intentionally incomplete under the spending limit.
- Tasks 2–3: prompt/tool schema and provider complete; mocked tests cover shape parsing, numeric coercion, retries, timeout and failures.
- Task 4: evaluator and acceptance-rule tests complete; full live run intentionally not performed. CLI requires explicit live opt-in and a request budget and stops after service failure.
- Tasks 5–6: conditional fallback branches not triggered by available evidence; no extra model/call introduced.
- Task 7: gated one-request live test and handoff complete. The live test remains skipped.

Scripts default to dry-run and never automatically load `.env.local`. Normal `npm run check` is offline. Synthetic cafe/noise fixtures are committed; the other eight planned speech fixtures and all consented human samples are absent. The missing cases are reported by evaluator dry-run. A dedicated ten-second WAV is required before reporting the spec's latency target.

Validation: `npm run check` passed (91 tests, one explicitly skipped live test; TypeScript and ESLint passed). All three script dry-runs passed and made zero requests.

The request parser supports a forced tool call or a balanced JSON object in text, rejects the wrong tool name and validates the complete shared schema. Scores and wrong-sentence rules remain composed in foundation. Provider failures contain no remote body, credentials, transcript or audio. Successful logs contain model, elapsed milliseconds and whitelisted usage numbers only.

No calibration result, native-speaker approval, production readiness, or exact total charge is claimed. Root must retain the acceptance gaps in QA/deployment notes and keep production release gated on the remaining user-supplied review/samples/access.
