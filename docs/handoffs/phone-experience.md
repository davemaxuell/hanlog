# Phone experience pass — 2026-11-16

## Phone-width fixes (320–430px, plus landscape)

An audit of every public and app route at 320, 375, 390 and 430px found no sideways scrolling. These issues were fixed:

| Issue | Fix |
| --- | --- |
| iPhone safe areas ignored (tab bar padding used `env()` without `viewport-fit=cover`) | `viewportFit: 'cover'` in `src/app/layout.tsx`; body and tab bar pad by the left/right insets |
| Mission "Level 1 · 10 pt" and score "Points" squeezed into a 32px margin column below 768px | `.hl-margin-row` stacks its label above the content below 768px |
| Practice and Progress filter menus at 14px make iOS Safari zoom on focus | 16px below 768px (`learning.module.css`) |
| Landing "Open the app" wrapped to two lines at 320px | `white-space:nowrap`, tighter header at ≤359px |
| Hero phrase tabs were 34px tall with 11px text | 40px tall, 12px text below 700px |
| Rewards milestone "Conversation builder" spilled out of its card | single column of compact rows below 480px |
| Tab bar used a fifth of a landscape phone screen | icon and label share one line when height ≤500px |

`tests/e2e/phone-layout.spec.ts` guards all of the above on the phone project.

## App tour on the landing page

"How it works" now shows a phone running the app (`src/components/intro/AppTour.tsx`, reusable frame in `src/components/ui/PhoneFrame.tsx`). The four existing steps choose the screen: practice list → recording → checking → AI feedback (88, +10 points) → peer rating (+27 points) → progress.

Choices (spec is silent):
- Screens are illustrations, labelled "Illustrated screens. Your real score comes from your own voice." with a "Try the real thing" link to the working recorder at `#try`. Numbers follow the real rules: café mission base 10 at score 88 earns 10; a 5★/4★ peer rating earns (5+4)×3 = 27.
- The phone is `aria-hidden`; a visually hidden figure caption describes the current screen. Steps are `aria-pressed` buttons inside the existing `h3` headings, matching the hero phrase tabs.
- The tour plays only while visible, never when animations are reduced, holds while a step has keyboard focus, and has a Pause/Play control. Choosing a step stops the tour on that step (the recording-to-score moment still plays once).
- On phones the step tiles sit above the phone so a tap changes a screen in view; the chosen step's text sits under the phone.

Not changed: the hero art (`HeroWindow`) and the `/demo` walkthrough, which had other uncommitted work in progress. `PhoneFrame` can be dropped into either later.
