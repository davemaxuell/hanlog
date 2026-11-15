# Open Window — original UI rules

**Status:** current proposed design direction, 15 November 2026.  
**Purpose:** an original, approachable interface with a recognizable visual language.  
**Preview:** [visual rules board](reference.html) · [design tokens](tokens.json)

“Open Window” is the name of this design direction, not a proposed product name. Product features and audience are still unspecified; the daily-entry examples illustrate the visual rules.

## The idea

A little room for everyday life. Build the interface around clear frames, open space, an airy pastel sky canvas, buttercream warmth, strawberry and blush star accents, and an encouraging voice. It should feel personal, bright, composed, and easy to return to.

*(Version 0.4 adopts the user-selected **Sky, Buttercream & Berry** palette (`#D2F6FC`, `#FCFCC6`, `#FC7CAC`, `#FCC4D8`, `#7CE4FC`) alongside Open Window's elaborated screen archetypes, architectural illustration grammar, and interactive control patterns.)*

The defining feature is **a useful margin**: dates, section labels, and small state markers sit beside the content, giving the screen a readable rhythm. A short corner mark identifies the current section. This structure gives the product a signature beyond its colors.

The Setlog study remains a source of lessons about approachability. This document replaces its replication recommendations for future design work. Every value below is our own proposed specification.

## 1. Give each color a job

| Token | Color | Rule |
|---|---|---|
| Canvas | `#D2F6FC` | Airy pastel sky background for the main screen |
| Surface | `#FFFEF9` | Milky cloud-white content surfaces and expanded panels |
| Ink | `#1E2436` | Deep midnight star-navy titles, body text, and button labels |
| Secondary text | `#4A566D` | Dusk slate dates, supporting descriptions, metadata |
| Action fill | `#FC7CAC` | Strawberry pink primary buttons (paired with `#1E2436` ink & `#B02D63` edge; hover `#F7659D`) |
| Action stroke / link | `#B02D63` | Accessible berry rose for links, focus rings, active tab underlines, corner marks, and `✓` squares |
| Action soft | `#FCE6EF` | Soft blush wash for active toggle states and saved confirmation cards |
| Blush accent | `#FCC4D8` | Blush pink decorative stars, secondary chips, and warm highlights (`#1E2436` ink only) |
| Sky star | `#7CE4FC` | Bright sky cyan decorative stars, badges, and window accents (`#1E2436` ink only) |
| Buttercream | `#FCFCC6` | Lemon buttercream yellow for one welcoming prompt or supportive message (`#1E2436` ink only) |
| Quiet line | `#A8D3DF` | Sky-tinted nonessential separators and window mullions |
| Control edge | `#5E7B8C` | Slate-sky boundaries that identify an input/control |
| Error ink / field | `#A32029` / `#FFF0EE` | Distinct crimson error icon and clear explanatory message |

**Composition rule:** make pastel sky and milky white dominant. Strawberry pink (`#FC7CAC`) and deep berry (`#B02D63`) identify action consistently everywhere. Buttercream (`#FCFCC6`) gives one focal area warmth. Bright sky (`#7CE4FC`) and blush (`#FCC4D8`) illuminate secondary accents and window illustrations. Error states remain distinct in brick crimson when needed.

Always use `#1E2436` ink (never white text) on buttercream `#FCFCC6`, strawberry `#FC7CAC`, blush `#FCC4D8`, and bright sky `#7CE4FC`; use `#B02D63` for text links, focus rings, and white `✓` badges. Calculated contrast: ink/canvas **13.47:1**, ink/surface **15.28:1**, secondary text/canvas **6.45:1**, ink/buttercream **14.61:1**, ink/actionFill **6.33:1**, surface/actionStroke **6.11:1**, ink/skyStar **10.55:1**, ink/blush **10.31:1**, error ink/error field **6.78:1**. Bright sky (`1.45:1` on white) and blush (`1.48:1` on white) must never be used for text or solo borders on light surfaces. Recheck actual rendered combinations and media.

## 2. Make the margin the organizing device

- On a wide composition, reserve a 56–72 px margin for a date, section label, or state marker. Align the content to one reading edge beside it.
- On phone screens, use a 28–36 px rail only for a short time or marker. Move longer labels above the group. At narrow widths or large text sizes, stack the margin above the content entirely.
- Group related entries with a shared heading and open space. Use a filled card when it communicates selection, input, or a contained task.
- Give each screen one dominant action with an explicit verb. Place it beside the task or in a reachable bottom action area, depending on the eventual product flow.
- Place names, captions, and actions below media. A portrait, bright photo, or long caption must not change their readability.

This creates an editorial index: information is easy to scan, and each entry has room to feel personal. Any example chronology is illustrative, not a committed app navigation model.

## 3. Repeat precise, gentle shapes

Use **8 px corners for compact fields**, **12 px for buttons and media**, and **20 px for an expanded sheet**. Full circles are reserved for people, capture controls where appropriate, and progress indicators. Small status badges use a 6 px radius.

The signature motif is a short right-angle corner mark around the active section heading. Use at most one per view, paired with a textual heading or selected-state semantics. It should orient the user. Use simple square markers in the margin for entry states.

Keep content frames flat. Use a thin border or background change for separation; a single soft shadow is reserved for overlays. Keep decoration outside input areas. Pattern work consists of short orthogonal lines, an occasional square, and the margin rhythm. Backgrounds remain solid so the reading area stays calm.

## 4. Pair an expressive title with practical text

Short, sentence-case serif titles introduce a screen. Body copy, controls, and metadata use a clear sans serif. The local board uses Georgia for Latin headings, Batang as a Korean serif fallback, and Malgun Gothic/Segoe UI for body text. These are prototype fallbacks; final Korean/English typography needs a joint review before shipping.

| Text role | Proposed size / line height | Weight and constraint |
|---|---|---|
| Phone screen title | 30–34 / 38–42 px | Regular serif; usually 1–2 lines |
| Section heading | 20 / 28 px | Semibold sans serif |
| Body | 16 / 24 px | Regular; comfortable Korean/English wrapping |
| Primary control | 16 / 22 px | Semibold; verb plus optional icon |
| Supporting text | 13 / 20 px | Regular; never essential fine print |
| Margin date/time | 12 / 18 px | Medium; tabular digits where supported |

Use normal letter spacing for Korean. Large text should reflow the layout rather than shrink. Give text beside media enough room to wrap naturally.

## 5. Set a generous rhythm

Base spacing: **4, 8, 12, 16, 24, 32, 48 px**. Phone gutters: **20 px**, reducing to **16 px** where needed. Use 24–32 px between content groups and 8–12 px within a group. A desktop content area can grow to 1120 px; keep long prose around 60–68 characters per line.

Buttons and touch controls have a minimum 48 px target. A primary button is a labelled rounded rectangle, with 18–24 px horizontal padding. Secondary actions use an outline or text label. Navigation uses text and an underline/rail marker. The selected state combines position, shape, and accessible state, not color alone.

## 6. Make friendliness a behavior

**Welcome with one useful sentence.** A line such as “What would you like to keep from today?” offers a starting point. An empty state then gives one clear action. Avoid stacking several competing prompts.

**Acknowledge an action in place.** After a successful save, change the label to “Saved,” show a check, and fill the adjacent margin marker. Keep the user's position stable. Confirm only after the operation succeeds.

**Make recovery reassuring.** Keep entered content available during an error. Explain the next step plainly: “That didn’t save yet. Try again.” Show an error label/icon with the error color. For pending work, use “Saving…” and a separate progress state.

**Let people set the pace.** Optional reminders and skipped steps should not create shame. Celebrate a contribution with a brief acknowledgment; make the next action easy to find.

Sample tone, authored for this direction:

| Situation | English | Korean |
|---|---|---|
| Welcome | “A little room for today.” | “오늘을 위한 작은 여유.” |
| Prompt | “What would you like to keep?” | “어떤 순간을 남겨볼까요?” |
| Success | “Saved. Come back whenever you like.” | “저장했어요. 편할 때 다시 들러요.” |
| Optional step | “You can do this later.” | “나중에 해도 괜찮아요.” |

## 7. Use motion to explain change

Press feedback: **120 ms**. Selection and marker fill: **160 ms**. Panel appearance: **220 ms**, using opacity and at most 8 px of movement. Keep content stationary after saving. Persistent movement is reserved for actual in-progress work.

Reduced-motion mode changes state immediately or uses a short fade. The check, label, and error message carry the information with or without animation. These are proposed timings to test on real devices.

## 8. Keep a clear identity boundary

| Area | Our governing rule |
|---|---|
| Color | Sky ground, milky white surfaces, strawberry/berry action, buttercream/blush/sky star details |
| Composition | Margin-led index with captions outside media |
| Header | Left-aligned editorial title; navigation has explicit labels |
| Shape | Modest 8–12 px corners and purposeful geometric marks |
| Personality | Language, imagery, thoughtful responses, and measured space |
| Decoration | A sparse corner/frame motif and crisp 5-point star accents in scene illustrations |
| Confirmation | Check + words + marker state in the same location |

Do not import Setlog's outlined wordmark, smile-face treatment, rainbow tape, doodle collection, centered room-name pills, or large timestamps over stacked photos as this product's signature. Those belong to the reference study. This boundary makes the new direction operational rather than a recoloring exercise.

## 9. Screen archetypes and elaborated app patterns

The visual rules above scale across four recurring application surfaces. Each surface relies on the margin rail, restrained surface separation, serif-to-sans hierarchy, and in-place feedback rather than floating pills or overlaid text.

### 9.1 The Daily Window (Margin-led timeline & time-of-day rhythm)

- **Left margin rail:** Holds tabular time (`12 / 18 px`), a `6 px`-radius status square (filled `#B02D63` berry rose with a `#FFFEF9` white check when contributed, outlined `#5E7B8C` when open), and the single active-section corner mark (`┌`) on the current time group.
- **Welcoming anchor:** One `#FCFCC6` buttercream yellow prompt card with `#1E2436` deep ink copy introduces the active time slot alongside one explicit-verb `#FC7CAC` strawberry pink primary action (`Add a moment` / `순간 남기기`, `#1E2436` text, `1.5 px` `#B02D63` edge, `min-height: 48 px`, `12 px` radius).
- **Below-media framing:** Media frames (`8–12 px` radius, `1 px` `#A8D3DF` border) keep all contributor names, circular avatars, captions, and quiet acknowledgements in a dedicated caption block below the image—never overlaid on photography or artwork.

### 9.2 The Inline Capture & Considerate Save Sheet

- **Sheet and field geometry:** Uses a `20 px`-radius `#FFFEF9` milky white surface container, an `8 px`-radius input field with `#5E7B8C` slate-sky control border, and an explicit secondary escape (`You can do this later` / `나중에 해도 괜찮아요`, `min-height: 48 px`).
- **Four-state in-place acknowledgement flow:**
  1. **Composing:** Calm prompt, editable field, clear primary save verb (`Save moment` / `순간 저장하기`), and optional escape.
  2. **Saving…:** `120 ms` press acknowledgement; entered content stays visible and stationary while a `6 px`-radius progress frame indicates active work.
  3. **Saved:** `160 ms` fill of the `26 × 26 px` (`6 px` radius) margin square in `#B02D63` berry rose with a white `✓`, label updating to `Saved` / `저장했어요`, `#FCE6EF` soft blush status wash, and calm reassurance (*"Saved. Ready when you return."*).
  4. **Recoverable Error:** Entered note text remains completely intact inside the input; a `#FFF0EE` error field with `#A32029` crimson error ink and a `6 px`-radius `!` error badge explains what happened alongside an explicit `Try again` / `다시 시도하기` action.

### 9.3 The Shared Table (Multi-person circle view)

- **Header and tabs:** Left-aligned serif room title paired with explicit underlined text tabs (`Today`, `Earlier`, `People`)—never centered room-name pills.
- **Presence and quiet pace:** A compact row of `28 px` circular person avatars (`#FC7CAC`, `#7CE4FC`, `#FCFCC6`, each paired with `#1E2436` ink) shows who shares the space without ranking or streak counters. Contributed moments align to the left margin rail with timestamp, media frame, caption, and an interactive below-media acknowledgement toggle (check + words + subtle `#FCE6EF` blush shift).
- **Zero-pressure empty slot:** When someone in the circle has not contributed yet, display a quiet dashed/quiet-line frame with calm, non-shaming copy (*"No moment yet — whenever Leo is ready."* / *"레오 님의 순간은 아직 비어 있어요. 천천히 남겨도 괜찮아요."*).

### 9.4 The Archive Index (Multi-day margin ledger)

- **Wide and responsive rails:** Uses the `56–72 px` wide margin on desktop to index dates (`15 Sun`, `14 Sat`, `12 Thu`) and square state markers beside compact media-and-caption rows, giving multi-day history the scannability of an editorial index.
- **Graceful reflow:** Collapses cleanly to a `28–36 px` marker rail on phone widths and stacks dates cleanly above each group on narrow viewports or enlarged text sizes.

## 10. Architectural illustration & media fallback grammar

When illustrating empty states, loading scenes, or abstract window studies without photography, compose shapes exclusively from Open Window's architectural vocabulary:

- **Window mullions & frames:** `1 px` orthogonal rules in `#A8D3DF` (quiet line) and `#5E7B8C` (control edge) inside `8–12 px` rounded frames.
- **Daylight & interior planes:** `#D2F6FC` pastel sky canvas, `#FCFCC6` buttercream warmth, and `#FFFEF9` milky white surface establishing sky, wall, and desk planes.
- **Time-of-day stars & warmth:** `#FCFCC6` buttercream sunbeams or lamp pools paired with crisp 5-point stars in `#FC7CAC` strawberry pink, `#FCC4D8` blush pink, and `#7CE4FC` bright sky cyan against `#1E2436` midnight silhouettes.
- **Tabletop accents:** `#FC7CAC` strawberry pink, `#FCC4D8` blush, and `#7CE4FC` sky reserved strictly for small sculptural objects (mugs, vases, planters, book spines) or `#1E2436`-inked elements so pale pastels never carry white text.

## Review before implementation

An initial screen should still look recognizable when its accent colors are removed: the margin, title hierarchy, frames, and captions should carry the identity. Then check:

- The main task is apparent within a few seconds.
- One welcoming element supplies warmth; the screen remains easy to scan.
- The action color means the same thing everywhere.
- Long Korean and English text, enlarged text, and narrow screens remain usable.
- Empty, saving, saved, error, keyboard-focus, and reduced-motion states are specified.
- Dates, names, and captions stay readable across varied content.

The [visual board](reference.html) provides an interactive design studio and component specimens for this system. The [tokens](tokens.json) are proposed values ready for a future prototype. Product architecture, final fonts, and any imagery remain to be decided in the context of the actual product.
