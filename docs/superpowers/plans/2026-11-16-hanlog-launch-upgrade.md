# HanLog launch upgrade — implementation plan

Status: implemented, locally verified, migrated, and deployed. Production account/community/storage checks passed; evidence is in docs/handoffs/launch-upgrade.md. Authorized by the owner to plan and execute automatically, including deployment to the existing Vercel project after verification.

## Product direction

Reference: `Daewoong_Thinking_Project_Topic2_Final.pptx`, modified 16 November 2026, nine slides. Slides 4–7 define the loop: brief everyday speaking → sharing → peer connection → feedback → repeat. This release makes the implemented mission/challenge loop useful for returning learners and Korean peers. It does not invent partner rewards, native-speaker validation, social activity, or reference recordings.

Visual source: Paperlogy bold display and Pretendard body, ink `#1E2436`, sky `#D2F6FC`, buttercream `#FCFCC6`, berry `#B02D63`, pink `#FC7CAC`, white `#FFFEF9`; strong outlines, shallow solid shadows, arch/window framing, restrained star details. Preserve the deck's identity while adapting its dense slides to responsive product screens. Korean brand spelling: 한록.

## Build sequence and ownership

1. **Continuity backend** — account recovery (random key, hash-only storage, atomic rotate/restore, session revocation, throttling), sign-out, owned-data export; practice history, Korea-time activity/streaks, saved missions. Own account/progress contracts, clients, routes, repos, migration `004`, session/user internals, and matching tests. Keep existing API envelopes compatible. No secret output or paid calls.
2. **Learning UI** — dashboard, searchable/filterable mission library, progress/history with real stored feedback, saved expressions, improved result actions. Own `/app` home, new `/app/missions` and `/app/progress` pages, mission components and feature CSS/tests. Preserve guest consent/recording/expiry flows.
3. **Community** — pagination and bounded reads, reliable role-specific discovery, share-code entry and persistent sharing, feedback inbox, auditable reports and operator review command. Own challenge/response repositories and routes, community contracts/client, challenge UI, migration `005`, matching tests. Preserve existing audience/privacy and media recovery semantics; roles are self-selected, not verification.
4. **Root integration/design** — shared tokens/styles/shell/navigation, local licensed fonts, brand assets, introduction, onboarding/recovery/profile UI, honest points/milestones, manifest/metadata/privacy/help, cross-lane integration, browser QA, deploy. Own global stylesheet, `components/ui`, intro components, account UI, root metadata, docs, public assets.

Independent feature work runs in parallel after contracts are agreed. Workers leave changes uncommitted until an integrated `npm run check` passes; then commit logical tasks without mixing ownership. Production remains on the existing main deployment until the upgrade is verified.

## Acceptance criteria

- [x] Deck-derived design is visibly consistent across landing, onboarding, learning, community, profile and progress; mobile navigation and 320px layouts work.
- [x] A returning user can restore their profile on another device, rotate the key, sign out without deleting, export owned data, and delete it.
- [x] Recovery credentials are never logged, included in exports, placed in URLs, or stored in plaintext in the database; replay and simultaneous restore fail safely.
- [x] Learners can search/filter 24 missions, save expressions, choose a next practice, and revisit stored feedback; progress is calculated from attempts, including zero-point practice.
- [x] Peer workflows support discovery, shared codes, actionable feedback follow-up and reporting without losing drafts or existing privacy safeguards.
- [x] New queries are bounded, ownership checked, stable under pagination, and work on PGlite and production PostgreSQL.
- [x] Accessibility, loading/empty/error states, keyboard/dialog focus, recording recovery and reduced-motion behavior pass appropriate checks.
- [x] Types, lint, unit/API/component tests, production build, bundle checks and meaningful browser journeys pass.
- [x] Additive production migrations applied before code rollout; deployed read-only and synthetic account/storage smoke pass. No additional paid scoring calls needed for this upgrade.

## Launch boundary

Public beta quality is the target. Real iPhone/Android hardware checks, consented learner calibration and native content review still require those real participants. Points are real app progress; commercial redemption and partner offers remain unavailable. No account provider, SMTP subscription, bulk AI audio generation or paid dependency is introduced.
