# HanLog presentation demo runbook

Prepared 16 November 2026. This runbook covers the dedicated `/demo` presentation and its four scenes: **Practice → Feedback → People → Progress**. Release acceptance is pending; record final evidence in the checklist below before using a new deployment on stage.

## Open the presentation

- Public presentation: [https://hanlog-nine.vercel.app/demo](https://hanlog-nine.vercel.app/demo)
- Public landing page: [https://hanlog-nine.vercel.app/](https://hanlog-nine.vercel.app/)
- Main app: [https://hanlog-nine.vercel.app/app](https://hanlog-nine.vercel.app/app)
- Expression library: [https://hanlog-nine.vercel.app/app/missions](https://hanlog-nine.vercel.app/app/missions)
- Community: [https://hanlog-nine.vercel.app/app/challenges](https://hanlog-nine.vercel.app/app/challenges)
- Practice history: [https://hanlog-nine.vercel.app/app/progress](https://hanlog-nine.vercel.app/app/progress)
- Help: [https://hanlog-nine.vercel.app/help](https://hanlog-nine.vercel.app/help)
- Privacy: [https://hanlog-nine.vercel.app/privacy](https://hanlog-nine.vercel.app/privacy)

Keep `/demo` ready in a separate browser tab before presenting. It opens in **Example walkthrough** with no API calls. The main app may require onboarding. Do not create or restore a profile for the first time while a recovery key could appear on the projector.

Use **Back** and **Next: [scene]** or left/right arrow keys to move through scenes. Use **Full screen** for the projected view and Escape to leave browser fullscreen. Arrow shortcuts ignore inputs and interactive controls. Scene navigation, mode changes, and **Restart walkthrough** remain locked while microphone permission, recording, conversion, or scoring is pending, and while an unsent ready clip remains. After recording, choose **Get my score**, or **Retake** to discard that clip before changing scenes or modes. Retake is unavailable while processing is pending. Do not reload to bypass the lock.

**Open example in a new tab** remains available in Live practice even while navigation is locked. Use it to continue the presentation with labelled examples while leaving the live tab intact. A submitted request may still finish and save its result in the original tab; opening an example does not cancel it. If connectivity is already lost, use the separate example tab loaded before the event rather than assuming a fresh tab can load offline.

**Restart walkthrough resets the presentation view only. It does not delete recordings, saved expressions, profiles, or practice history.** Discard an unsent clip with Retake before restarting; once a submission is in progress, wait for it or use the new-tab example fallback.

Before the audience arrives, select **Restart walkthrough** to return to the opening scene. For the real-AI version, then choose **Live practice** and complete the deliberate consent/session step, **Start live practice**, before the presentation begins. Confirm the selected environment actually uses AI. The local mock launcher never becomes real AI merely because Live practice is selected. The live result can continue directly through Feedback, People, and Progress without navigating the main app menus.

## Choose the mode deliberately

| Mode | What the audience is seeing | Persistence and network |
| --- | --- | --- |
| **Example walkthrough** | Authored illustrative practice, feedback, peer exchange, and progress. Say “example” before showing these values. | No scoring request, profile creation, or API writes. Once the page and its required assets have loaded, the example scenes can continue without the server. This is not a cold-offline app or a service-worker installation. |
| **Live practice** on the public site | The existing real mission flow, started with consent using a guest or the current profile. A completed result is the response from the configured scoring provider. | Uploads the submitted solo recording for processing and saves the actual attempt/result. Network access and a functioning backend are needed. A real AI result must be labelled as such only when its provider is AI. |
| **Live practice** through the local demo launcher (`npm run demo` for a prepared build; `npm run dev:demo` for preparation) | The same functional practice flow with the mock provider forced by the local launcher. | No paid AI request; mock results can still create real local attempts and history in the isolated demo database. Call this a mock rehearsal, not a live AI assessment. |

**Prepare demo** offers an optional microphone check that is local only. It is a device check, not a scored attempt: stop it when finished, do not upload it, and do not describe its output as AI feedback. Grant microphone access only when needed. A microphone check does not prove that the scoring service or venue network is available.

The People scene's illustrated exchange stays an **example** even during a live-practice presentation. A real community reply is asynchronous; it does not arrive automatically because the scene advanced. Open the real community/challenge separately when demonstrating that part of the product.

Do not change the signed-in profile in another tab of the same browser during a live attempt. If the browser's profile changes, or cannot be verified when returning to the tab, the live flow discards any unsent clip and requires consent and **Start live practice** again. Read the displayed profile name before recording again. This does not undo a request already sent or erase saved history.

## Before the audience arrives

### Presentation and privacy

- [ ] Use the canonical nine-slide `Daewoong_Thinking_Project_Topic2_Final.pptx`. See [the deck reference](handoffs/presentation-deck-reference.md) for the newer alternate and the reason the current app keeps the Final identity.
- [ ] Prepare the transition after Final slide 5, “Our Solution,” or slide 6, “Concept Definition.” Return to slide 7, the proposed stakeholder ecosystem, after the demo.
- [ ] Close unrelated tabs and turn off notification previews. Confirm that the projected window contains only the intended deck/app.
- [ ] Choose a consenting presenter-owned profile or guest session for the live attempt. Review any history and names that may appear. Do not expose another person's account or recordings.
- [ ] Complete account recovery off the projector if needed. Keep recovery keys, credentials, downloads containing personal data, and developer/network panels off screen. Do not paste keys into the runbook or speaker notes.
- [ ] Use Restart walkthrough before stage time. Explain whether the run is Example walkthrough, public Live practice, or a local mock rehearsal. For real AI, choose Live practice and complete Start live practice before presenting; keep mode/provider labels visible.

### Sound, connection, and timing

- [ ] Use the same laptop, browser, microphone, and display connection as the event. Load all four example scenes in advance.
- [ ] Check venue connectivity and the public page. Keep an already-loaded Example walkthrough in a separate tab as the fallback, and locate Open example in a new tab in the live view.
- [ ] Select the intended microphone. A stage microphone connected to the venue speakers may not be the laptop's recording input; test the actual browser input.
- [ ] Make the local microphone check in a quiet moment. Speak at a calm conversational volume near the selected input; do not shout toward distant speakers. Avoid feedback from the PA system.
- [ ] Confirm microphone permission before the live segment. If using playback, check its volume and avoid feeding the playback into the microphone.
- [ ] Rehearse with Example walkthrough or the isolated mock launcher. Do not spend paid scoring calls to chase a more impressive result.
- [ ] For the event, plan **one logical scored attempt**. One submission may cause an initial provider call and one internal provider retry, so it is not a promise of exactly one billable provider request. Do not click submit repeatedly or repeat the attempt to obtain a target score.
- [ ] Speak for no more than the mission's 15-second recording limit. Budget for processing time; if the slot is slipping while the live view is locked, choose Open example in a new tab and announce the change. For an unsent ready clip, Retake discards it and unlocks a same-tab mode change.

## Three-minute presentation script

This is the default four-scene path, beginning with the café **iced Americano** mission. For a live run, enter Live practice and complete its consent/session choice before submitting. For an example run, replace the live-recording sentences with the provided example line. A lower, unexpected, or imperfect actual score is still the real result; present it without replacing it with the slide's mock score. The authored peer invitation **SMPL24** is a sample, not a verified real community invitation; use the actual challenge link returned by the app when leaving the example.

| Time | Screen and action | English presenter script | Brief Korean line |
| --- | --- | --- | --- |
| **0:00–0:20** | Switch from Final slide 5 or 6 to `/demo`. Show the mode. | “HanLog turns a small part of everyday phone time into a chance to speak Korean. I will show the loop: practise, get feedback, connect with people, and return to what you learned.” Add either “This is an illustrative walkthrough” or “I will make one real practice attempt using my own voice.” | “일상 속 한 문장이 연습, 피드백, 교류, 다음 연습으로 이어지는 흐름입니다.” State “예시 화면입니다” when applicable. |
| **0:20–1:00** | **Practice.** Explain the displayed iced Americano café expression and situation. In live mode, record one short attempt, review it if desired, and submit once. | “The starting point is an expression I could actually use today: ordering an iced Americano. I see what it means and where it fits, then try it in my own voice.” For Example walkthrough: “The recording and practice state here illustrate that step; we are not sending audio to AI.” | “카페에서 아이스 아메리카노를 주문하는 표현을 짧게 직접 말해 봅니다.” |
| **1:00–1:40** | **Feedback.** Show the actual completed result, or the clearly labelled example. Read one useful next tip. If live processing is still pending and time is short, use Open example in a new tab; do not try to change the locked live scene or imply success. | Live: “This is the result returned for that attempt. The useful part is one concrete thing I can try next, not a promised score.” Example: “This is sample feedback to explain the experience, not a result from a recording today.” Explain that practice scores are guidance, not a language qualification or calibrated accuracy measure. | “점수보다 다음 시도에서 바꿔 볼 한 가지를 봅니다. 발음 평가의 정확도가 검증됐다는 뜻은 아닙니다.” |
| **1:40–2:20** | **People.** Show the illustrated exchange, identify it as an example, then open the real community/challenge if prepared. | “This exchange is an example of the peer interaction. In the real community, a Korean-speaking peer can post a challenge and another learner can answer. Replies happen asynchronously; we are not waiting for an instant response on stage.” If opening real content: “Here is the actual challenge page.” | “이 대화는 교류 방식을 보여 주는 예시입니다. 실제 답변은 각자 가능한 시간에 주고받습니다.” |
| **2:20–2:50** | **Progress.** Explain returning to saved expressions and previous attempts. If showing actual history, open the main progress page and identify it separately from illustrative scene content. | “The next visit has somewhere to begin: saved expressions and the feedback from previous attempts. This is how the product supports another practice session; this example does not establish retention or learning improvement.” With real history: “This is the actual history for the profile used today.” | “저장한 표현과 이전 피드백이 다음 연습의 시작점이 됩니다.” |
| **2:50–3:00** | End on the next-practice action, then return to slide 7. | “The idea is simple: one everyday expression, a small attempt, and a reason to return. The next step is to test that loop with learners and Korean-speaking peers.” | “오늘 한 문장을 말하고, 다음 연습으로 이어가게 합니다.” |

Suggested deck transition: **“We have described the concept. Now I will show how one expression moves through the experience.”** / **“지금까지 설명한 개념이 한 문장 연습에서 어떻게 이어지는지 보여 드리겠습니다.”**

If a genuine AI result includes a surprising transcription, score, or tip, acknowledge it: **“That is what the system returned for this recording. This beta still needs learner calibration and native-speaker review.”** Do not promise a fixed 94, call a mock score AI-generated, or quietly substitute an example result.

## Optional timing branches

### 90 seconds: entirely in Example walkthrough

Use this branch when time is limited or the venue connection is uncertain. Do not add a live scored attempt.

1. **0:00–0:10:** Say this is an illustrative walkthrough and introduce the everyday-expression problem.
2. **0:10–0:30, Practice:** Show the expression and the short speaking task.
3. **0:30–0:50, Feedback:** Point to one sample next tip, explicitly calling it an example.
4. **0:50–1:10, People:** Explain the illustrated asynchronous exchange.
5. **1:10–1:25, Progress:** Show how saved words and attempt history give a starting point for another visit. Do not infer retention from the example.
6. **1:25–1:30:** Return to the deck: “One everyday expression becomes the next small practice opportunity.”

### Five minutes: one live attempt plus real app detail

Keep the same four scenes and the same one-submission budget.

1. **0:00–0:30:** Explain the mode and obtain any needed presenter consent.
2. **0:30–1:30, Practice:** Choose the displayed mission, explain its context, record once, and submit once.
3. **1:30–2:30, Feedback:** Review the actual result and one next tip. If the backend fails or remains pending, choose Open example in a new tab and announce that its feedback is illustrative. Leave the live tab intact; a submitted request may still finish.
4. **2:30–3:40, People:** Label the illustrated exchange, then open a prepared real challenge. Explain the two-identity flow below without waiting for a new peer to arrive.
5. **3:40–4:40, Progress:** Open actual history and the expression library for the profile used today. Show the stored result if it completed, and a saved expression if one genuinely exists. Empty states are legitimate.
6. **4:40–5:00:** Return to the deck and describe the next validation work. Take questions without making another scored attempt.

## Demonstrating a real peer exchange

The three-minute default shows the clearly labelled example and can open an existing real challenge. Creating, answering, and reviewing a real exchange needs two separate browser identities and more preparation.

1. Use a presenter-controlled **Korean-speaking peer** profile in browser identity A and a consenting **learner** profile in identity B. Separate browser profiles or separate browsers work; two ordinary tabs in one profile share the same session and are not two identities.
2. Before the event, A may deliberately post a challenge with consented presenter-owned media. Posting is a real write and may be visible in the community; do not present it as a private draft or submit it merely to populate a screenshot.
3. Open that challenge's actual share URL or six-character invitation code in B. Use the link returned by the product; do not invent a challenge ID or invitation.
4. If an actual reply is part of the planned demonstration, B records/submits its own answer and A later opens the answer to respond. These are real community actions. Confirm who can see the recording before submitting.
5. Show only consented content, label any presenter-created demonstration profiles as such, and explain that peer roles are self-selected, not verified tutor credentials.

Do not imply a real peer is responding immediately when showing an authored exchange. If there is no prepared challenge or the real board is empty, show its honest empty state and finish the explanation in Example walkthrough.

## Failure and fallback decisions

| Situation | Presenter action | Say this |
| --- | --- | --- |
| Microphone unavailable, denied, or too noisy | Stop the local check/live recorder when its control is available. If a ready clip remains, use Retake to discard it before changing modes. While permission/capture is pending or the live view is locked, choose Open example in a new tab instead. | “The venue microphone is not ready, so I will explain the flow with a labelled example in another tab.” |
| Unsent ready clip, but the presenter wants to continue with examples | Use Retake to discard the clip before changing modes, or Open example in a new tab to leave the clip in its original live tab. Retake here means discard, not another paid scoring attempt. | “This clip has not been submitted. I will continue with a labelled example.” |
| Slow network, timeout, conversion failure, or scoring error | Do not resubmit repeatedly. Choose Open example in a new tab while the live view is locked. Keep the live tab intact; a submitted request may still finish and save. If processing has ended but a ready clip remains, Retake must discard it before a same-tab mode change. | “I do not have a completed result to show. I am opening the example in another tab; that feedback is illustrative. A submitted live request may still finish.” |
| Profile changes in another tab, or the live flow cannot verify it | Follow the displayed notice: the unsent clip is discarded. Review consent and choose Start live practice again only if continuing live is appropriate; confirm the profile name. For the timed presentation, use the example fallback instead of rushing through recovery. | “The browser profile changed or could not be verified. The unsent clip was discarded, and a fresh consent step is required before another live attempt.” |
| Real AI returns a low/unexpected score or imperfect feedback | Present the actual result and one useful next step. Do not rerun to chase a score. | “This is the result for this attempt. The beta still needs calibration, and practice scores are guidance.” |
| No actual community response or no prepared challenge | Show the real empty/pending state or stay with the labelled illustrated exchange. | “Peer replies are asynchronous. This example explains what the exchange is designed to support.” |
| No prior progress | Show the empty history honestly. Keep illustrative progress clearly separate. | “This profile is starting today. The illustrated progress shows the structure, not this person's activity.” |
| Connection lost after the presentation has loaded | Continue the already-loaded Example walkthrough tab. Do not refresh or follow server-dependent app links. If the live tab is locked, do not try to switch its mode; a fresh example tab still needs its assets to load. | “The loaded examples can continue locally; the live app still needs its server.” |
| Public site unavailable before loading | Use the prestarted local mock rehearsal if available, or return to the deck. | “This is our local mock rehearsal. It is not a live AI result.” |

### Optional local rehearsal and stage fallback

For the stage, prefer an **already-built and checked production version**. From the repository root, with dependencies and that build already prepared:

```powershell
npm run demo
```

Open [http://localhost:3000/demo](http://localhost:3000/demo), or use the port printed by the launcher if it was configured differently. Start it before the audience arrives and load all presentation scenes. `npm run demo` serves the existing build; it does not create one. Prepare and check the build before the event, not during the presentation.

If development mode is needed while preparing or rehearsing changes, use:

```powershell
npm run dev:demo
```

This is a preparation option, not the preferred stage server. Starting a development server or waiting for route compilation should happen before the audience arrives. Both commands use the isolated mock launcher.

`scripts/run-demo.mjs` forces `SCORING_PROVIDER=mock`, empties the AI API key and external database/storage settings, and uses `.data/demo-db` and `.data/demo-media`. Mock practice still saves local history. Example walkthrough itself does not submit these writes. Restarting the presentation or server does not erase that database. Do not put real keys into this rehearsal or delete history to reset the stage view.

An already-loaded example view is the network fallback. Neither launcher nor the presentation establishes cold-offline availability, service-worker caching, or offline private recordings.

## Acceptance record — 16 November 2026

Local implementation and acceptance are complete. Exact results and hosted release evidence are in the [presentation release handoff](handoffs/presentation-demo.md). Chromium uses synthetic microphone input; this does not replace the venue or real-device rehearsal.

- [ ] Record application commit/deployment, verification date, and presenter browser.
- [ ] Public `/demo` loads directly, and all main-app links route correctly.
- [x] Practice → Feedback → People → Progress works by controls and keyboard; input interactions do not unintentionally change scenes.
- [x] Fullscreen enter/exit works in tested Chromium, with a usable non-fullscreen view.
- [x] Example walkthrough labels all authored results/activity and makes no scoring, profile-creation, or other API write requests.
- [x] All example scenes and the QR continue after loading when the network is unavailable; no cold-offline claim is shown.
- [x] Optional microphone check is local only, requests permission deliberately, stops its tracks, and neither uploads nor scores audio.
- [x] Live practice requires intentional consent/start and uses the existing mission flow; actual mock response/provider labels were verified without paid requests.
- [x] Scene/mode navigation and restart remain locked during permission, recording, conversion, scoring, and an unsent ready clip. Retake discards a ready clip before navigation; Open example in a new tab remains available while locked.
- [x] Profile-change/unverifiable-session regressions discard an unsent clip and require consent/start again without deleting history.
- [x] A completed attempt appears in the real local journal. Mode changes/restart preserve saved history, and pending requests are not described as cancelled.
- [x] The People example remains illustrative in both modes and links to a seeded sample challenge.
- [x] Progress distinguishes authored previews from an actual completed attempt; no fabricated activity is presented as persistence.
- [x] The local launcher configuration forces mock scoring with isolated persistence; `dev:demo` was exercised. No paid AI calls were used.
- [x] Projector/desktop and narrow-screen layouts, keyboard focus, and settled-screen contrast passed browser checks. Reduced-motion CSS was reviewed.
- [x] Type/lint/test/build/browser evidence and unresolved limits are recorded in the release handoff.

Evidence: **472 unit/API/component tests passed; 49 browser cases validated across the full suite and targeted presentation rerun; production build and bundle checks passed.**

Unresolved limits: real iPhone/Android capture, actual venue microphone/projector/QR scanning, native-speaker content review, and pronunciation calibration. Rehearse before the event; use the displayed result without promising a particular score.
