# Social layer and Motion pass — 2026-11-16

For the live demo, people trying the app can now see each other's progress, share photos, and compare in groups. A Motion layer adds movement across the landing page and the new screens.

## Social features

Community (bottom tab) now opens a hub with four sections: **Feed · Challenges · Groups · Ranks**. The Community tab stays highlighted in all four.

- **Ranks** `/app/leaderboard`: everyone with points, ranked, with Today (from midnight Korea time) and All time. Ties share a rank. Each row shows points, expressions practised, and the average of each person's best score per expression. It refreshes every 20 seconds while visible, so it works on a projector. **Top today** (top three plus your rank) is on the Today screen. Me → Leaderboards hides you from public boards.
- **Feed** `/app/feed`, `/app/feed/new`: a "Korean moment" is one photo plus the Korean expression it shows (must contain Hangul), its meaning, and an optional note. People can like a post with the button or by double-tapping the photo. Reporting hides a post from the reporter at once; two reports hide it from everyone. Authors can delete their own posts.
- **Groups** `/app/groups`, `/app/groups/[id]`: start a group, then share its 6-character code or the invite link `/app/groups?join=CODE`. Members are ranked with the same details as Ranks, including members hidden from public boards. A member can leave; the owner closes the group for everyone.

Choices (the spec is silent on these):
- **Photos:** the browser re-encodes photos to JPEG (at most 1280 px on the longest side). The server accepts only complete JPEGs of 120–2048 px and 1.5 MB at most. It strips EXIF and other metadata segments, including GPS (`src/lib/media/jpeg.ts`).
- **Moderation:** when an OpenAI key is set, the photo and its text are checked together with `omni-moderation-latest`. Links are always rejected.
- **Storage:** photos use the existing private media store, deletion queue, cleanup job and account deletion, and expire after 14 days like recordings. Exports now include posts, liked posts, post reports and groups.
- **Points:** the first 3 posts each Korea day earn 5 points each. Likes earn nothing, so they can't be farmed.
- **Limits** (plus at most 10 wrong group codes per profile per hour, so codes cannot be guessed):
  - posts: 6 per day
  - groups: 5 started per day, 10 memberships per person, 50 members per group
  - reports: the existing daily cap applies

The privacy notice has a new section, "Feed, leaderboards and groups", and updated retention, deletion and processor lines.

**Deployment:** migrations `008_social.sql` and `009_group_join_limits.sql` must be applied to the hosted database (`npm run db:migrate`) before deploying. It has not been run against production.

## Motion (motion.dev, `motion@14.14.0`)

Every effect respects the footer and presentation "Reduce animations" switch and the device setting. `MotionLibraryConfig` binds Motion's React components to the switch; vanilla effects check `motionAllowed()`. Reveals are transform-only, so content is never hidden while it waits for scroll or JavaScript. Turning motion off mid-effect leaves everything at rest.

- **Landing page** (`LandingMotion`):
  - a reading progress line
  - a word-by-word headline lift (masked words in `Hero`)
  - hero art parallax
  - a magnetic call-to-action button for mouse users
  - the app-tour phone gliding against the scroll
  - step, reward and FAQ cards rising in a cascade
- **App:**
  - a sliding active pill in the bottom navigation, Community tabs and period switch (shared layout)
  - leaderboard rows that glide to new ranks, with points counting up and comparison bars growing
  - double-tap-to-like with a heart burst, and a bouncing like icon
  - feed cards rising into view
  - a "+5" points pop after sharing
  - a photo preview that springs into place
  - the group join code flipping in letter by letter
  - group cards with spring hover and press
  - hopping loading dots

Motion's own repository skills are for Motion maintainers. The user-facing skill installs with `npx motion-ai`, which also adds MCP servers to the Claude Code setup; it was not installed.
