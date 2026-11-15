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

Migration `002_pending_media_deletions.sql` adds an RLS-enabled private queue. New file paths are registered before storage receives bytes. A successful metadata transaction clears the new-path marker and, on replacement, queues the old path in the same transaction. Replacements use fresh file paths, so a failed write cannot overwrite the earlier recording. Removal failure leaves the durable marker for cleanup. The queue holds paths only, with no profile foreign key, so profile deletion cannot erase the recovery record.

Cleanup waits one hour before retrying abandoned uploads and excludes all paths referenced by challenges or responses. Expired referenced recordings continue through the existing locked expiry path. The grace period exceeds the upload request deadline. New, unreferenced files are never exposed by playback routes.

## Validation

- Streaming/origin/config/duration tests observed failing before fixes; 21 cases passed after the initial changes.
- Media/repository/migration regressions: 41 passed across 8 targeted files.
- Remaining API regressions and the expanded real-PostgreSQL suite: 32 passed across 7 files. PostgreSQL exercised atomic mission awards, scoring caps, concurrent peer ratings, and profile deletion waiting for an in-flight answer.
- Boundary-duration test observed failing before the approved tolerance adjustment; final duration/origin/config verification passed all **22 cases**. TypeScript and ESLint pass for the touched backend/tests.
- Root runs the final integrated check/build in main. No dependency files were modified here; root's audited checkpoint `dd03858` was merged.
- The disposable PostgreSQL container was stopped and auto-removed after verification. Docker Desktop remains available; existing containers/volumes were not stopped or deleted.
