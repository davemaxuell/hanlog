# Presentation demo release — 16 November 2026

Public entry: [HanLog product walkthrough](https://hanlog-nine.vercel.app/demo). Presenter instructions: [three-minute runbook](../demo-runbook.md), including English/Korean narration and 90-second/five-minute variants.

## What changed

- Four scenes explain the core loop: a useful Korean phrase, actionable feedback, peer exchange, and returning to saved practice. The canonical Final PowerPoint supplies the navy/sky/buttercream/pink palette, bundled typography, window motif, and ink outlines. Original slides are untouched; see the [deck reference](presentation-deck-reference.md).
- Example walkthrough starts without session creation, microphone access, or API writes. Authored scores, conversations, and journal previews are explicitly labelled. Loaded example scenes and their preloaded audience QR remain available after disconnecting the network. This is not a cold-start offline application.
- Live practice uses the real existing session, consent, scoring, and journal paths. Local rehearsal forces mock scoring and retains the mock disclosure. A completed response is shown as received; there is no score target, hidden retry, or substituted example result.
- Local-only preparation records, plays back, and discards a microphone check. Fullscreen has a normal-window fallback. Keyboard navigation ignores form/media controls and modal preparation. Scene changes restore the top of the presentation.
- Capture, conversion, submission, and unsent clips lock scene/mode changes. Retake explicitly discards a ready clip. The separate example-tab link remains available; a submitted request can still finish in its original tab. Restart resets presentation state and preserves account history.
- Live practice verifies the profile on return/session-change events and immediately before submission. A changed or unverifiable profile discards an unsent clip and requires renewed consent/start. A profile-change announcement also clears a completed result from the presentation view without deleting saved account data.
- Audience QR opens the public website; the People scene links to an actual seeded challenge, and actual completed practice links to the real journal. The illustrated exchange is never represented as a received peer reply.
- Tailwind source discovery is restricted to runtime files under `src`. Installed-loader inspection confirmed the reduction from 339 to 165 source dependencies. An observed development reload loop stopped after this change; the precise originating filesystem event was not established.

## Verification

- `npm run check`: **472 passed, 18 gated skips** (17 PostgreSQL concurrency cases and one paid-provider case); typecheck and lint passed. No backend/database change was made, so the prior real-PostgreSQL audit remains separate evidence.
- Production browser suite: the 42 existing cases passed. All **7 new presentation cases passed** after correcting test synchronization for passive effects, native dialog focus, and entrance-animation completion. Seven duplicate phone accessibility sweeps are intentionally skipped. Coverage includes one actual mock submission and saved journal entry, no-write offline examples, QR loading, clip locks/Retake, local playback and track/URL cleanup, 320/390/1366/1440 layouts, projector footer fit, keyboard operation, and zero serious/critical axe findings on the settled presentation scenes and preparation dialog.
- Production build passed through the browser runner. `npm run check:bundle` passed for the client bundle and staged repository. **47 server traces contained zero private `.env`, `.data`, test, or documentation paths.**
- Manual Chromium review: projector screenshots at 1366×768, phone screenshots at 390×844, all four example scenes, consent layout, fullscreen enter/exit, and stable local development navigation. Reduced-motion CSS was reviewed. Screenshots remain in ignored `output/playwright/`.
- Hosted deployment and read-only verification are recorded after publication below. No paid AI requests were made.

## Limits

No paid scoring calls are used for this upgrade. Existing production OpenAI configuration and limits are unchanged. A frontend submission can still invoke the provider's existing bounded retry. Actual Korean pronunciation calibration, native-speaker content review, real iPhone/Android capture, and venue microphone/projector/QR rehearsal remain owner validation items. The presentation makes no verified-accuracy, learning-outcome, user-traction, commercial-redemption, or partnership claim.
