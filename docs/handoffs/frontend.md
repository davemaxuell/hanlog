# Frontend handoff

## Scope and status

Frontend plan tasks 1–12 are implemented on `ws/frontend`. Tasks 13 (Me and share-link routing) and 14 (integrated build/browser QA) were reassigned to the orchestrator to finish the local app in parallel. The tasks 1–8 checkpoint was `7650e09`; subsequent work preserves that ancestry.

The shared primitives, recorder, session provider, mission flow, all mission/reward/challenge screens, and recoverable API errors use the frozen contracts and API client. No live API calls or secret files were used by this workstream.

## Screens and automated coverage

| Surface | Test file |
|---|---|
| UI controls, language attributes, stars, meters | `tests/ui/primitives.test.tsx` |
| WAV conversion and short/undecodable audio | `tests/ui/to-wav.test.tsx` |
| Capture, MIME choice, hidden/unmount cleanup, simultaneous video/audio | `tests/ui/use-recorder.test.tsx` |
| Recorder preview, retake, upload, double-submit, callback recovery | `tests/ui/recorder.test.tsx` |
| Score feedback and point states | `tests/ui/score-card.test.tsx` |
| Session guard, onboarding, late session lookup | `tests/ui/session.test.tsx` |
| Home: today, levels, Korean-role pending count, retry | `tests/ui/home.test.tsx` |
| Mission: conversion, submission, retry, reference availability | `tests/ui/mission-flow.test.tsx` |
| Rewards: balance, progress arithmetic, ledger, empty state | `tests/ui/rewards.test.tsx` |
| Challenge board: role-specific lists and counts | `tests/ui/challenges.test.tsx` |
| Posting: Hangul validation, copy link, role guard, retained input | `tests/ui/challenge-new.test.tsx` |
| Detail: answer, rate, feedback, report, media expiry and URL cleanup | `tests/ui/challenge-detail.test.tsx` |

Every task's prescribed tests were first run failing, then implemented. `npm run check` passed at each task commit; task 12 passed 127 tests across 28 files, with clean typecheck and lint. The final check, including the session-race regression, passed 128 tests across 28 files with clean typecheck and lint.

## Integration notes

- `MissionFlow` does not require a SessionProvider. Its optional `headingLevel={2}` lets the introduction page maintain one h1; default remains 1. `convert` and recorder `deps` remain injectable.
- `ChallengeDetailPage` is exported from `src/components/challenge/ChallengeDetailPage.tsx`. The route only exports its default wrapper, avoiding unsupported Next page exports while retaining test injection.
- The answered-challenge list contract contains no response status. The board loads each answered challenge's authorized detail to display `Waiting for rating` or `Rated`; no contract was changed.
- Session updates invalidate a pending initial session read, so a late signed-out response cannot erase a profile just created by onboarding.
- Recording tracks stop on stop, reset, unmount, and hidden-page events. Late permissions are discarded. Playback and preview URLs are revoked, including late playback responses after unmount.
- Native report confirmation is modal when `showModal` is available, restores prior focus, and supports Escape. The fallback exists for the unit-test environment.

## Design and final verification boundary

Styles use the copied v0.4 Sky, Buttercream & Berry tokens, dark ink on pink actions with berry borders, berry links/focus/state markers, and the margin/serif hierarchy. Korean expressions and feedback are language tagged. Layout includes narrow-screen stacking, flexible controls, reduced-motion rules, and visible keyboard focus.

No browser width/device walkthrough was completed in this worktree. The orchestrator owns final integrated checks at 320, 390, and 1440 px, microphone/mock-scoring walkthrough, production build, and device follow-up. The task 8 integrated production build already passed in main according to the orchestrator. Do not treat JSDOM recorder tests as iPhone/Android verification.
