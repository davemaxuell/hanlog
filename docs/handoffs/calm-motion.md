# Calm motion upgrade — 16 November 2026

HanLog now has one motion vocabulary across the public introduction, working app, and presentation route. The existing PowerPoint palette, content, scoring, and recording limits stay intact.

## Behavior

- Hero art settles once; visible landing sections enter once as they are reached. Scroll position remains native and content is never hidden while waiting for JavaScript or an observer.
- Presentation scenes have a sliding active marker, short directional entrances, and restrained panel/score-track choreography. Keyboard changes are immediate. Scene selection, capture locks, actual result labels, and offline examples retain their existing behavior.
- Buttons, links, saved expressions, native dialogs, journal disclosures, and success notices give light visual feedback. Fine-pointer hover effects do not apply as sticky touch movement. Errors are immediately visible and do not shake.
- Busy indicators are tied to actual work. Recording state has a small indicator and smooth level changes derived from the existing real microphone readings. Scores and accessible meter values appear immediately; only decorative fills animate. No fake waveform, numerical count-up, autoplay sound, artificial loading percentage, or ambient animation loop is added.
- **Reduce animations** is available in the landing/app footers and presentation toolbar. The browser-only `hl_motion_reduced` preference persists and synchronizes between tabs. OS reduced-motion settings always take precedence. The server renders a still page; optional motion starts after the preference is read. No account or API mutation is involved.
- Route entrances use a stable, unkeyed content wrapper. They cancel when navigation is interrupted or motion is reduced, and keyboard navigation skips the entrance. Preferences, balances, and animation completion do not remount or gate forms and recorders.

## Implementation

Shared durations are 140ms for small controls, 220ms for normal UI changes, and 320ms for scenes, with `cubic-bezier(.22,1,.36,1)` easing. Marketing art has a bounded sub-700ms entrance. Motion uses CSS transforms and native Web Animations; no dependency or backend change was added. Genuine busy/recording indicators stop when their work ends and become still under reduced motion.

## Verification

Local `npm run check`: **489 passed, 18 gated skips**; typecheck and lint passed. Added regressions cover stored/device/tab preferences, blocked storage, preserved drafts, cancellable route entry, keyboard input, observer lifecycle, actual busy state and microphone/score values.

The full browser suite passed **55 cases with 7 skips**. After the final community-card reduced-motion adjustment, a fresh production build and all **8 motion browser cases** passed (6 repeated checks plus 2 new community cases), for **57 distinct passing browser cases**. Coverage includes phone/desktop preferences, tab synchronization, OS reduction, rapid and keyboard scene changes, no-JavaScript landing content, community navigation, and changing preferences during microphone capture. Production build, accessibility sweeps, and final scoped typecheck/lint passed.

Visual review covered 1366×768 presentation, 320px phone toolbar wrapping, and 1440×900 landing layout. No paid AI calls were made. Physical-device frame-rate and actual venue hardware remain rehearsal checks; automated browser results do not establish them.

## Production release

- Application commit: `4a85a993057a57f4d20aa77bb4e0c5b83b894841`.
- [GitHub check 43753679400](https://github.com/davemaxuell/hanlog/actions/runs/43753679400) passed on that exact commit in **6m29s**, including typecheck, lint, tests, production build with mock scoring, and bundle/repository checks.
- Vercel production deployment: `dpl_92n36sU1sn6tQJP4d1jHFt59FM3L`, **READY**, build approximately 44 seconds. Public alias: <https://hanlog-nine.vercel.app>; walkthrough: <https://hanlog-nine.vercel.app/demo>.
- Client bundle/repository secret scan passed. All **47 server traces** excluded private local data, environment files, tests, and documentation.
- GET-only production smoke passed: empty session, 24 missions, security headers, and authenticated cleanup protection.
- Live browser review passed: scene navigation, 1366px projector layout, 320px phone layout without horizontal overflow, FAQ interaction, and motion preference surviving navigation/reload. Reduced mode had no active animations. The example walkthrough made no API requests. Browser console had no errors; existing QR/prefetch preload warnings remain informational.
- Deployment-scoped Vercel error/fatal log query returned no entries after smoke checks. External drain inventory could not be verified through the connector; this check is not an uptime-monitoring guarantee.
