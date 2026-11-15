# HanLog presentation demo

Purpose: make the working beta easy to demonstrate alongside the PowerPoint in about three minutes. Present a useful phrase, actionable feedback, the human exchange, and saved practice. Do not invent traction, accuracy evidence, partnerships, completed exchanges, or learning gains.

The existing Open Window v0.5 tokens and canonical Final deck remain the design source. A newer Option2 deck is an alternate sage/terracotta treatment; it is not silently substituted for the deployed brand. Original PowerPoint files stay untouched.

## Implementation order and ownership

1. Root: `/demo` server page and `DemoExperience` shell, projector-sized scenes, navigation, fullscreen, responsive styling, discoverability, and orchestration tests.
2. Live worker: consented real practice reusing `MissionFlow`, local-only microphone check, bounded activity callbacks and focused tests. Scoring/provider/database behavior remains unchanged.
3. Story worker: pure example/live feedback, clearly illustrated peer exchange, actual-result-aware progress panels. No API calls or synthetic account history.
4. Deck worker: three-minute runbook, short/extended variants, PPT transitions, evidence and claim boundaries.
5. Root: integration, visual browser review, accessibility, full checks and mock browser rehearsals; publish through the existing GitHub/Vercel pipeline and verify public routes. No paid scoring calls during implementation.

## Behavior

- `/demo` starts in **Example walkthrough**. No consent, session creation, recording or AI request occurs automatically. Example feedback and exchanges are visibly labelled. The loaded example remains navigable when the network is disabled; this is not a cold-start offline app.
- **Live practice** requires consent and explicit start. It reuses the current profile or creates a guest and submits through the existing real API. Actual outcomes, including low scores and zero additional points, remain unchanged. Local mock responses keep their existing disclosure.
- Four scenes: Practice → Feedback → People → Progress. Feedback/progress in live mode require a result. Arrows do not hijack editable/interactive controls, open setup, recording or pending submission. Changing scenes moves accessible focus; reduced motion is respected.
- **Prepare demo** records and plays locally without calling scoring. Closing it releases the microphone. Fullscreen is requested only by a user gesture and has a normal-layout fallback.
- Restart resets the walkthrough, never deletes a profile or history. Real activity blocks scene/mode changes; an explicit example link opens a separate tab if a live request is slow, without starting another AI request.
- No AI score is guaranteed. One submission can invoke the existing provider retry; frontend presentation controls are not a financial cap.

## Acceptance

- Regression tests for mode/result separation, no example API mutations, explicit live preparation, recording/activity navigation guards, keyboard controls, and restart preserving account data.
- Browser rehearsal of all example scenes with network disabled after load, local mic preparation, one mock-scored live flow and real saved history, responsive widths 320/390/1366/1440, accessibility and keyboard navigation.
- Full `npm run check`, production build, browser suite, bundle/private-file checks, GitHub CI and Vercel deployment verification.
- Runbook preserves real-device and Korean/pronunciation calibration limitations. A winning pitch is an aim, not a guaranteed result.
