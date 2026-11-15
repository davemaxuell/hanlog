# Community launch upgrade

The community board remains at `/app/challenges` under the Community navigation item. It now has role-aware cards, expression/name search, invitation code entry, independent section refresh, paging, and an inbox derived from actual received ratings and learner feedback. Authors can share an existing challenge from its detail page.

## API and data

- `GET /api/challenges` preserves the `challenges` array and adds `nextCursor`. Optional `q` (80 characters), `limit` (1–50), and opaque `cursor`; default 20. Board requests use six cards per page. One aggregate query supplies all per-card response counts.
- `GET /api/challenges/:id` returns at most 20 initial answers and `responsesNextCursor`. An optional `response=<uuid>` loads at most one additional private response for an inbox link, after challenge, audience, and report checks.
- `GET /api/challenges/:id/responses` serves bounded answer pages to the same eligible raters as challenge detail. `GET /api/community/inbox` returns only the session user's received ratings/feedback, with bounded pagination.
- Cursors preserve PostgreSQL microsecond precision and use timestamp plus UUID ordering. Public timestamps remain ISO strings.
- Migration `005_community.sql` creates report audit records, uniqueness constraints, indexes, and private-schema RLS.

## Reports and recording privacy

Report categories are harassment, inappropriate content, spam, privacy, and other. There is no free-text report field. Reports store reporter ID, target IDs, category, open/dismissed/actioned status, creation time, and review time. A person can submit 10 reports per Korean calendar day across both target types. Duplicate retries do not consume the limit or create another record. Dismissed reports cannot be re-opened by resubmitting the same target.

Answer reports immediately hide the recording and answer from review lists. Challenge reports hide that challenge only from the reporter's feed, detail, reference endpoint, answer endpoint, and inbox; they do not remove sample challenges for everyone. Authors cannot report their own challenge. An operator can action a challenge report to hide it globally, or dismiss it to restore visibility. A recording stays hidden while any open/actioned report remains; a challenge stays globally hidden while any actioned challenge report remains.

Reports have no independent automatic expiry. Foreign-key cascades remove them with their reporter or associated content. Deleting a reporter does not itself restore a previously hidden recording. The existing 14-day recording retention, private audiences, media deletion queue, and point rules are unchanged. Roles are self-selected, not tutor verification.

## Operator command

This is a server-only CLI, not an app role or public admin route. It requires an explicitly supplied `DATABASE_URL` or `POSTGRES_URL`; it does not load environment files. Never paste credentials into a shell command or logs.

```text
npx tsx scripts/review-community-reports.ts list --status=open --limit=20
npx tsx scripts/review-community-reports.ts review <report-uuid> dismissed
npx tsx scripts/review-community-reports.ts review <report-uuid> dismissed --apply
npx tsx scripts/review-community-reports.ts review <report-uuid> actioned --apply
```

Review defaults to a dry run and requires `--apply` to change data. List output contains report/target IDs, reason, status, and timestamps, with no reporter identities, media bytes, or credentials. The command is a metadata/review tool; it does not provide an operator media viewer. The product promises no response deadline.

## UI behavior and validation

Conversation refresh preserves unfinished recordings and rating/feedback drafts. New ratings appear without a full reload. Sample-answer copy accurately identifies eligible Korean-speaking peers. A responder who switches to the Korean-speaking role retains their exchange but must switch back to replace an unrated recording. Reports use a reason selector, cancel-first dialog focus, and a reporting-specific daily-cap message.

Validation completed locally without real API calls:

- 47 targeted API/UI/CLI tests passed, including timestamp precision, bounded responses, inbox ownership, older-response deep links, per-viewer challenge hiding, report deduplication, mixed-target caps, overlapping reports, draft preservation, and role switching.
- TypeScript and scoped ESLint passed.
- Inspected community desktop and 390px screenshots. Measured zero horizontal overflow at 390px and 320px. Artifacts are in ignored `output/playwright/community-*.png`.
- Peer browser coverage now uses Community navigation and opens the real feedback inbox. It waits for the asynchronous rating controls before measuring all ten 48px touch targets.
- Account browser coverage exercises saved expressions and scored history across reload and recovery in another browser, replacement-key acknowledgment and old-key rejection, data download, and deletion. Recovery credentials stay in memory; traces, screenshots, and video are disabled for that suite.
- Final integrated verification reported by the parent: `npm run check` passed with 386 tests passing and 11 intentionally skipped; the production build and browser suite passed with 38 tests passing and six intentionally skipped; all ten disposable PostgreSQL checks passed. The client bundle scan was clean.
- The responsive/accessibility sweep includes Help, Practice, Progress, Community, points, profile, mission detail, and challenge detail. Its community inline-link finding was fixed with an explicit underline.

This lane has not deployed, mutated production data, or spent API credit. The owned community and browser-test changes are ready to commit after the integrated checks above.
