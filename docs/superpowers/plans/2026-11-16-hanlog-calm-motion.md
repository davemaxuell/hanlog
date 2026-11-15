# Calm motion upgrade

Purpose: make HanLog feel responsive, relaxed, and presentation-ready while preserving recording, profile, and scoring behavior. Keep the PowerPoint-derived palette and typography. Use CSS transforms/opacity and native browser animation rather than adding a library.

## Work

1. Root: shared motion tokens, local motion preference following the OS, footer controls, cancellable route entrance without remounting content, global tactile/focus/dialog/status feedback, tests and release.
2. Intro: progressively enhanced one-shot section/hero choreography, interactive link/FAQ feedback, no hidden fallback content or scrolling takeover.
3. Demo: interruptible scene indicator, direction-aware scene entry, keyboard/reduced-motion bypass, brief feedback choreography, preserve projector fit and recording guards.
4. Feedback: real busy indicators, microphone state and smoothly rendered actual input level, truthful score bar reveal, confirmed save feedback.

## Rules

- Normal interactions remain immediate. Animation completion never gates navigation, permission, playback, scoring, saving, or dismissal.
- No numerical score count-up, artificial progress, fake audio waveform, autoplay audio, ambient looping art, or confetti.
- Only actual loading/recording status may animate repeatedly; reduced motion keeps its static label. Hover transforms apply to fine pointers. Keyboard actions keep immediate response.
- Respect `prefers-reduced-motion` and a persistent browser-only preference; synchronize across tabs without calling an API. No motion preference is attached to the user's account.
- Content remains visible with JavaScript unavailable. Existing mounted capture/form state must survive preference and balance changes.
- Verify desktop/phone, reduced motion, keyboard, no overflow, existing offline examples and media lifecycle, full checks/build/browser tests, bundle safety, GitHub CI and public deployment. No paid AI calls.
