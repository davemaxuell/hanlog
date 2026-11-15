# Presentation deck reference

Read-only deck inspection completed 16 November 2026. No original PowerPoint files were changed. This note separates the current app's canonical reference from a newer alternate and records which presentation claims are conceptual.

## Selected reference and file order

The app and `/demo` keep the **Final deck / Open Window v0.5** identity already selected in [launch-upgrade.md](launch-upgrade.md) and [tokens.json](../design/open-window/tokens.json). Do not call Final the newest filesystem file.

All three decks are in `C:/Users/user/Desktop/대웅/` and have nine slides.

| File | Last modified, Korea time | Relationship to the app |
| --- | --- | --- |
| `Daewoong_Thinking_Project_Topic2_Final.pptx` | **2026-11-16 01:23:07 +09:00** | Canonical current product and visual reference. |
| `Daewoong_Thinking_Project_Topic2_LowContrast.pptx` | **2026-11-16 01:39:56 +09:00** | Same extracted slide text as Final; softened palette. |
| `Daewoong_Thinking_Project_Topic2_Template_Option2.pptx` | **2026-11-16 01:47:23 +09:00** | Newest alternate file; reorganized layouts and sage/terracotta colors. Similar product narrative, with wording/layout changes. It was not silently adopted as the app brand. |

Actual OOXML content, fonts, colors, and shapes were inspected in all three files. Existing Final renders were visually reviewed: the full nine-slide contact sheet and full-size slides 5 and 6. These ignored local artifacts are in `.data/deck-launch-renders/`: `contact-sheet.jpg`, `slide-001.png` through `slide-009.png`, and `Daewoong_Thinking_Project_Topic2_Final.pdf`. The slide-5 render was modified at 01:34:52 KST and the contact sheet at 01:35:28 KST on 16 November. They are Final renders, not evidence of Option2's rendered appearance.

## Product narrative in the actual slides

| Slides | What the deck says | What a presenter can safely say |
| --- | --- | --- |
| 1–2 | Everyday Korean learning for international students; a design-thinking project by Team 3. | State the audience and the project context. |
| 3 | Persona Aisha has TOPIK 4 but limited time, speaking anxiety, textbook-to-real-speech gaps, and few natural opportunities to meet Korean peers. | “The persona helped us frame the problem.” Do not describe her as a proven customer or infer research sample size. |
| 4 | Turn everyday smartphone time into learning time through 15-second missions. | “We aim to make a small speaking opportunity part of an existing habit.” This is the design premise, not a demonstrated behavior change. |
| 5 | Short mission → everyday sharing → peer interaction → AI feedback; four pillars of mission, sharing, community, and gamification. | Introduce the practice loop, then show what the current product actually supports. |
| 6 | Gen Z international students and Korean university peers meet through short everyday/trendy expression practice. | Describe the intended audience and the combination of everyday expressions, speaking practice, and peer exchange. |
| 7 | Daily sharing, AI/interaction, mutual growth, and a proposed student/mentor/Daewoong ecosystem. | Separate current features from proposed partners, rewards, and future validation. |
| 8–9 | Reflection on empathy, creative thinking, teamwork, and AI-assisted prototyping; thanks and questions. | Close on what the team learned and what needs to be tested next. |

The core promise is **“일상이 곧 한국어가 되는 소셜 학습 플랫폼.”** A suitable English explanation is: **“An everyday Korean practice experience that connects short speaking attempts, feedback, and peer exchange.”**

The proposed differentiation is the combination of real-life expressions, a short speaking habit, and Korean-speaking peer interaction. The deck does not establish a measured advantage over other learning products.

## Claim boundaries for the demonstration

- **94 points** on slides 5/7 is a prototype feedback value. It is not 94% accuracy, a guaranteed live result, or evidence of validated pronunciation assessment. Present whatever score the real provider returns for the one submitted attempt.
- **24 likes, +3 expression recommendations, and +80 PT** are slide mockup values. Do not treat them as actual activity or current reward rules.
- **60% classes / 35% work / no spare study time** are unsourced persona illustrations. Do not quote them as survey findings or market statistics.
- **“원어민처럼 자연스러워요”** is example feedback. It is not a promised outcome or an established assessment capability.
- **15-second video, photo/text sharing, squads, shared albums, and rewards** belong to the broader concept where the current release does not demonstrate them. Show the actual mission/recording/community flow without implying a complete short-video social network.
- **Daewoong Foundation and Daewoong Pharmaceutical** appear as proposed ecosystem partners. This is not proof of a contract, sponsorship, integration, customer relationship, or reward entitlement.
- The deck supplies no substantiated revenue, pricing, paid-customer, market-size, retention, learning-outcome, or scoring-calibration evidence. Do not invent these for the demo.
- The launch handoff identifies the product as a public beta. Native-speaker review and consented learner calibration remain. Peer roles are self-selected; do not call them verified tutors.

Example walkthrough scenes must display and announce their illustrative status. Live practice must identify its actual scoring provider. The local `dev:demo` launcher uses mock scoring and can save local history; it must not be described as real AI evaluation. The asynchronous peer example remains illustrative even when the presenter has just completed a real speaking attempt.

## Visual identity to carry into `/demo`

| Element | Actual Final reference and app direction |
| --- | --- |
| Display type | Paperlogy 6 SemiBold, 7 Bold, and 8 ExtraBold in the deck; use the app's bundled Paperlogy display typography. |
| Body and controls | Pretendard Regular, Medium, and SemiBold; use the app's bundled Pretendard styles. |
| Structure | Navy ink outlines, rounded rectangles, restrained solid offset shadows, generous titles, and one dominant content/demo area. |
| Signature | Arched four-pane window, prominent on opening and closing slides. |
| Supporting motifs | Small five-point stars, circular person icons, and a numbered practice flow. Use sparingly; they must not obscure controls or meaning. |
| Colors | Ink `#1E2436`; surface `#FFFEF9`; sky `#D2F6FC`; bright sky `#7CE4FC`; buttercream `#FCFCC6`; pink `#FC7CAC`; berry `#B02D63`; blush `#FCC4D8`. |
| Legibility | Dark ink on pastel actions/surfaces, explicit labels, visible focus, and readable Korean/English line breaks. |

The older [DESIGN.md](../design/open-window/DESIGN.md) still describes v0.4 serif headings, a corner-mark signature, and an unspecified product. For this presentation, the later **v0.5 `tokens.json`, launch handoff, and actual Final slides** govern the typography, arch/window mark, and product context. Do not reintroduce the older Georgia/Batang direction or adopt Option2's palette without an explicit new design decision.

## Deck-to-demo transition

Preferred entry: after **Final slide 5, “Our Solution”**. Alternative: after **slide 6, “Concept Definition”** if the audience needs the target-user explanation first.

Say: **“We have described the concept. Now I will show how one expression moves through the experience.”** / **“지금까지 설명한 개념이 한 문장 연습에서 어떻게 이어지는지 보여 드리겠습니다.”**

Open [https://hanlog-nine.vercel.app/demo](https://hanlog-nine.vercel.app/demo) and follow **Practice → Feedback → People → Progress**. Announce Example walkthrough or Live practice before showing feedback. Return to slide 7 and introduce its ecosystem as a proposal.

The [demo runbook](../demo-runbook.md) contains the three-minute English script, short Korean presenter lines, 90-second and five-minute branches, microphone/privacy preparation, local mock rehearsal, and explicit fallback rules. It also records the pending release acceptance checklist; this deck inspection does not establish that `/demo` has passed implementation checks or been deployed.
