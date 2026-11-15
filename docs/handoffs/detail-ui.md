# UI recovery refinements

## Fixed behavior

- An expired session now clears cached authentication before redirecting. API reads, mutations, mission scoring, challenge posting, media playback, and profile updates share the same recovery path. This prevents onboarding from immediately redirecting the expired profile back to its failing page.
- Points requests use session and request versions. A late initial response cannot overwrite a newer balance, and an unmounted provider cannot navigate after a late failure. Failed loads show an unavailable state, distinct from zero, with an explicit retry. Updated points are announced politely.
- Retaking a selected challenge reference clears the parent form's attached media. Asynchronous recorder submission also locks retake, mode changes, and upload until it finishes, even when the caller does not supply its own busy state.
- A failed microphone-level meter teardown no longer prevents media tracks from stopping; cancellation still releases tracks if the browser recorder's stop call throws.
- Temporary playback/network failures offer a retry. Only a not-found response uses the existing expired-recording message. Playback errors release the failed blob URL.
- Reporting an answer announces success, removes it from the list, restores focus to the Answers heading, and gives the last-answer case an explicit empty state.
- Rating targets retain a minimum 48 px width and wrap safely on narrow screens. The existing palette and fixed error copy remain in place.
- Private `/app` and `/c` routes now inherit `noindex,nofollow` metadata.

## Evidence

The first targeted run reproduced 12 failures across six files, with 31 existing tests still passing. After the fixes, all 43 tests in those files passed with `--maxWorkers=2`.

Regression coverage lives in `tests/ui/session.test.tsx`, `me.test.tsx`, `recorder.test.tsx`, `use-recorder.test.tsx`, `challenge-reference.test.tsx`, and `challenge-detail.test.tsx`. The reference-form regression isolates the recorder component contract; the recorder test separately checks that an actual Retake interaction notifies the owner.

Final `npm run check -- -- --maxWorkers=2` passed: 56 test files passed, 2 skipped; 289 tests passed, 3 skipped. Typecheck passed. Two ref-cleanup lint warnings were fixed and the affected file was linted again with no warnings. The dependency checkpoint `dd03858` was merged before that check. No dependencies were installed and no paid API calls, application server, or production build were run in this worktree.

## Integration checks owned by root

Verify native modal focus and star hit areas at 320/390 px in the integrated browser build. A useful expired-session walkthrough is clearing the browser's session cookie on Me and then saving: it should stay on onboarding. Check `/app/onboarding` and `/c/...` response metadata for `noindex,nofollow`. Actual iPhone/Android microphone behavior remains a physical-device check; mocked tests do not establish that coverage.
