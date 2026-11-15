# Backend release refinements

Scope: request bounds/origin validation, actual peer media inspection, durable upload recovery, production configuration, and local PostgreSQL concurrency verification. No paid service calls; no local secret files read.

## Findings and intended changes

- Multipart requests were fully buffered before inspecting the file size. Bound the request stream, including unknown-length bodies and multipart overhead, and also bound JSON bodies.
- Origin comparison checked only the host. Require a canonical origin with the expected scheme and reject cross-site Fetch Metadata when Origin is absent.
- Peer media trusted the caller's duration and only sniffed a container signature. Inspect actual tracks and timing with server-only Mediabunny, including WebM without duration metadata and fragmented MP4. Reject disguised video and malformed files.
- Upload compensation could fail twice and leave a file without metadata. Track pending removals durably, use immutable replacement files, and retry unreferenced paths through cleanup after an in-flight grace period.
- Production outside Vercel could silently use in-memory data or partially configured remote storage. Require an explicit local database path or Postgres, and complete remote-storage credentials. `PGLITE_DIR=memory://` deliberately opts into ephemeral storage for production-mode E2E tests; the normal demo supplies a persistent path.
- Docker Desktop was available but stopped. Started it hidden and created only the disposable `hanlog-detail-pg` container, PostgreSQL 17, published on `127.0.0.1:55439`. No existing container, volume, or user database was modified.

## Media parser rationale

Mediabunny's [reading guide](https://mediabunny.dev/guide/reading-media-files) exposes computed track end timestamps separately from optional duration metadata. Its [format support](https://mediabunny.dev/guide/supported-formats-and-codecs) covers WebM, MP4, Ogg, and WAV. Only demuxing is used; no native codecs, ffprobe process, remote URLs, or paid calls are involved at runtime. Root owns dependency installation and audit.

Synthetic fixtures under `tests/fixtures/media` were generated locally with FFmpeg from silence and a black frame. They contain no personal recordings. The WebM fixture uses live output without duration metadata; MP4 fixtures use fragmented output.

Computed peer duration is authoritative; the supplied field still must satisfy the input contract but cannot hide overlong bytes. With root approval, peer containers get at most 100ms of encoding-tail tolerance above 20 seconds, and stored/displayed duration is capped to 20,000ms. A 20.021s AAC container is accepted, while a 20.101s WebM container is rejected even if it claims one second. Solo scoring WAV limits are unchanged. Silent peer recordings remain valid, while solo silence is handled by its existing RMS check.

Only these four local-buffer formats are enabled. Malformed containers and mismatched audio/video tracks are rejected. Request memory is bounded by the 4 MB file cap plus 64 KiB multipart envelope (700 KB plus envelope for scoring), and JSON is capped at 16 KiB. Peer upload routes declare a 30-second platform runtime deadline. This is not a hard CPU interruption in a standalone Node process; demuxing is synchronous JavaScript between asynchronous reads, so a timer alone cannot guarantee interruption of adversarial CPU-heavy parser work. No native process or remote fetch is used. The maintained parser, small byte cap, narrow format list, and platform deadline are the current safeguards.

## Durable media recovery

Migration `002_pending_media_deletions.sql` adds an RLS-enabled private queue. Migration `003_pending_media_ownership.sql` adds uploader, challenge, and challenge-author IDs without cascading foreign keys. New file paths are registered under owner/parent locks before storage receives bytes. A successful metadata transaction clears the new-path marker and, on replacement, queues the old path in the same transaction. Replacements use fresh file paths, so a failed write cannot overwrite the earlier recording. Removal failure leaves the durable marker for cleanup. Profile deletion includes its abandoned/replaced paths and paths from its authored challenges; a removal failure keeps identity and queue metadata for retry.

Cleanup waits one hour before retrying abandoned uploads and excludes all paths referenced by challenges or responses. Expired referenced recordings continue through the existing locked expiry path. The grace period exceeds the upload request deadline. New, unreferenced files are never exposed by playback routes. Metadata attachment, compensation, cleanup, and profile deletion share per-path advisory locks; compensation rechecks references after acquiring the lock. A lost COMMIT reply therefore returns a retriable error without destroying a file whose metadata actually committed.

Reference writes hold owner and parent locks through storage and metadata attachment. Incomplete-challenge compensation locks the parent first, then uses a separate statement to check for a committed reference or answers. This avoids a stale DELETE snapshot cascading a newly committed answer while waiting for its parent share lock.

Migration 003 backfills ownership where existing metadata or a first-upload path identifies it. Older unreferenced replacement paths from migration 002 alone cannot always be attributed retrospectively; they retain the existing timed cleanup behavior. The new queue was introduced during this unreleased refinement, and all new writes record ownership.

## Validation

- Streaming/origin/config/duration tests observed failing before fixes; 21 cases passed after the initial changes.
- Media/repository/migration regressions: 41 passed across 8 targeted files.
- Remaining API regressions and the expanded real-PostgreSQL suite: 32 passed across 7 files. PostgreSQL exercised atomic mission awards, scoring caps, concurrent peer ratings, and profile deletion waiting for an in-flight answer.
- Boundary-duration test observed failing before the approved tolerance adjustment; final duration/origin/config verification passed all **22 cases**. TypeScript and ESLint pass for the touched backend/tests.
- Root runs the final integrated check/build in main. No dependency files were modified here; root's audited checkpoint `dd03858` was merged.
- The disposable PostgreSQL container was stopped and auto-removed after verification. Docker Desktop remains available; existing containers/volumes were not stopped or deleted.

## Review follow-up

- Commit-then-throw DB wrappers reproduced and then verified preservation of committed response bytes and reference metadata/bytes.
- Queued replacement files are included when either their learner or challenge author deletes their profile; failure returns 503 and retry removes every owned path. An abandoned reference is also included after its incomplete challenge row is gone.
- A gated real-PostgreSQL test reproduced the incomplete-challenge stale-snapshot cascade before the fix. It and the other five concurrency cases pass after the fix.
- Final full `npm run check`: **294 passed, 7 gated skips**, with TypeScript and ESLint green. The six PostgreSQL cases passed separately against the disposable PostgreSQL 17 container; the other skip is the paid OpenAI smoke test. The review follow-up container was stopped and auto-removed.
