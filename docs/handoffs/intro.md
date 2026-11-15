# Introduction handoff

This branch owns introduction tasks 1–3: section components, the consent-gated live try panel, and the assembled public page. Root took tasks 4–5 (privacy page, icon and share image) in `ws/public-assets` to finish in parallel. The confirmed operator is **HanLog team**, not a placeholder.

All fixed section copy and section order follow plan 06. Added copy explains everyday practice, the three obstacles, the steps, peer feedback and future reward examples. Rewards carry the required unconfirmed-partners disclaimer. The only hero corner mark, margin-led steps, original window illustration and scoped responsive CSS use the current v0.4 Sky, Buttercream & Berry tokens. No shared stylesheet or component was modified in this branch.

TryNow makes no API or microphone request before consent. It reuses an existing session, creates at most one guest while preparation is in flight, preserves the session across toggles, hides/unmounts the recorder on withdrawal, shows the shared error wording and retry, and reuses MissionFlow for recording, conversion, scoring and the result. The guest-limit explanation mentions a shared network. Scores expose a link to continue in the app. Tests use the existing fake recorder and mocked API; no paid requests were made.

Integration dependency: frontend added optional `headingLevel` to MissionFlow in `fc7a8cd`. TryNow supplies 2, preserving the hero as the single h1 after consent. This branch's earlier frontend snapshot tolerates that additional prop, but final integration must include the frontend update.

Root owns final production build and browser verification at 320, 390, 768 and 1440 pixels, keyboard focus, reduced motion and live mock capture. They were not repeated in this worktree because its dependency junction prevents the planned build. CSS is designed for those widths; visual verification is not claimed here.

Validation: each task's tests failed before implementation. `npm run check` passed before the task 1 commit (218 tests), task 2 commit (223 tests), and final task 3 commit (225 tests across 44 passing files; three live tests skipped). TypeScript and ESLint passed. Introduction tests cover fixed copy, forbidden claims, section order, metadata, consent, recording through a mocked API, session reuse, failure/retry and rapid toggles.

The official link [OpenAI's privacy policy](https://openai.com/policies/privacy-policy/) was opened successfully on 2026-11-15. Privacy implementation should describe the actual local demo and intended production services accurately, avoid provider-retention claims, and mention the short-lived detached abuse counters specified by backend integration.
