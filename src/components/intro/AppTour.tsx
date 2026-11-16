'use client';
import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { ArrowUpRight, ChartLineUp, ChatsCircle, CheckCircle, MagnifyingGlass, Microphone, Notebook, Pause, Play, Sparkle } from '@phosphor-icons/react';
import { PhoneFrame, type PhoneTab } from '@/components/ui/PhoneFrame';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import styles from './appTour.module.css';

type Phase = 'recording' | 'checking' | 'result';
const TICK = 100;
const RECORD_UNTIL = 2_500;
const CHECK_UNTIL = 3_600;
const steps = [
  { title: 'Find your words', body: 'Choose something you can actually use today. Café orders, campus life, making plans and more.', icon: Notebook, duration: 4_500 },
  { title: 'Give it a voice', body: 'Try a short recording. Get specific AI practice feedback, then try again at your own pace.', icon: Microphone, duration: 8_000 },
  { title: 'Make a connection', body: 'Answer a peer challenge with a short voice or video clip. Give and receive thoughtful feedback.', icon: ChatsCircle, duration: 6_000 },
  { title: 'Keep the good bits', body: 'Save expressions, revisit your feedback, and see the little moments of practice add up.', icon: ChartLineUp, duration: 5_500 },
];
const tabs: PhoneTab[] = ['Practice', 'Practice', 'Community', 'Progress'];

function describe(step: number, phase: Phase, seconds: number) {
  const prefix = 'Illustrated HanLog app screen: ';
  if (step === 0) return `${prefix}today's practice missions, starting with a café order worth up to 10 points.`;
  if (step === 1) {
    if (phase === 'recording') return `${prefix}recording the café order, ${seconds} seconds in.`;
    if (phase === 'checking') return `${prefix}checking the recording.`;
    return `${prefix}AI practice feedback with an overall score of 88 out of 100, and +10 points.`;
  }
  if (step === 2) return `${prefix}a Korean-speaking peer rated your answer five stars for pronunciation and four for naturalness, and +27 points.`;
  return `${prefix}your progress with a 4-day streak, 7 of 24 expressions practised, and 28 points to the next milestone.`;
}

/** The how-it-works steps, each shown on a phone running the app. Plays only while visible and never while animations are reduced. */
export function AppTour() {
  const reduced = useMotionPreference()?.reduced ?? true;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [tour, setTour] = useState({ active: 0, elapsed: 0 });
  const [playing, setPlaying] = useState(true);
  const [preview, setPreview] = useState(false);
  const [inView, setInView] = useState(false);
  const [hold, setHold] = useState(false);
  const { active, elapsed } = tour;

  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: .3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visible = inView || typeof IntersectionObserver === 'undefined';
  // A chosen step still plays its own recording-to-score moment once; the tour itself stays put.
  const ticking = !reduced && visible && !hold && (playing || (preview && active === 1 && elapsed < CHECK_UNTIL));
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setTour(state => {
      const next = state.elapsed + TICK;
      if (playing && next >= steps[state.active].duration) return { active: (state.active + 1) % steps.length, elapsed: 0 };
      return { ...state, elapsed: next };
    }), TICK);
    return () => window.clearInterval(timer);
  }, [ticking, playing]);

  const phase: Phase = reduced || active !== 1 ? 'result' : elapsed < RECORD_UNTIL ? 'recording' : elapsed < CHECK_UNTIL ? 'checking' : 'result';
  const seconds = Math.min(4, Math.floor(elapsed / 600) + 1);
  const points = active === 0 || (active === 1 && phase !== 'result') ? 85 : active === 1 ? 95 : 122;
  const select = (index: number) => { setTour({ active: index, elapsed: 0 }); setPlaying(false); setPreview(true); };
  const toggle = () => { setPlaying(value => !value); setPreview(false); };
  const releaseHold = (event: FocusEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHold(false); };
  const progress = { '--progress': Math.min(1, elapsed / steps[active].duration) } as CSSProperties;

  return <div ref={root} className={styles.tour} data-playing={ticking || undefined}>
    <figure className={styles.stage} aria-labelledby={`${id}-screen`}>
      <div className={styles.frame}>
        <div className={styles.window} aria-hidden="true"><span className={styles.sun} /><span className={styles.star}>✦</span><span className={styles.starSmall}>✦</span></div>
        <PhoneFrame tab={tabs[active]} points={points} className={styles.phone}>
          <div key={active} className={styles.screenIn}>
            {active === 0 && <PracticeScreen />}
            {active === 1 && <VoiceScreen phase={phase} seconds={seconds} animate={!reduced} />}
            {active === 2 && <ConnectionScreen />}
            {active === 3 && <ProgressScreen />}
          </div>
        </PhoneFrame>
      </div>
      {/* Phones show the chosen step's text under the phone; the step list keeps the same text for assistive technology. */}
      <p className={styles.activeBody} aria-hidden="true">{steps[active].body}</p>
      <figcaption id={`${id}-screen`} className="hl-sr-only">{describe(active, phase, seconds)}</figcaption>
    </figure>
    <div className={styles.side}>
      <ol className={styles.steps} onFocus={() => setHold(true)} onBlur={releaseHold}>
        {steps.map(({ title, body, icon: Icon }, index) => <li key={title} className={styles.step} data-active={index === active || undefined}>
          <span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span>
          <div className={styles.stepText}>
            <h3><button type="button" aria-pressed={index === active} aria-describedby={`${id}-step-${index}`} onClick={() => select(index)}>{title}</button></h3>
            <p id={`${id}-step-${index}`}>{body}</p>
          </div>
          <Icon className={styles.stepIcon} size={30} weight="duotone" aria-hidden="true" />
          {index === active && playing && !reduced && <span className={styles.progress} style={progress} aria-hidden="true" />}
        </li>)}
      </ol>
      <div className={styles.footer}>
        <p className={styles.note}>Illustrated screens. Your real score comes from your own voice.</p>
        <div className={styles.actions}>
          <a className="hl-link-button" href="#try">Try the real thing <ArrowUpRight size={19} aria-hidden="true" /></a>
          {!reduced && <button type="button" className={styles.toggle} aria-label={playing ? 'Pause the app tour' : 'Play the app tour'} onClick={toggle}>
            {playing ? <Pause size={18} weight="fill" aria-hidden="true" /> : <Play size={18} weight="fill" aria-hidden="true" />}{playing ? 'Pause' : 'Play'}
          </button>}
        </div>
      </div>
    </div>
  </div>;
}

function PracticeScreen() {
  const missions = [
    { level: 'Level 1 · café', ko: '아이스 아메리카노 한 잔 주세요.', en: 'One iced Americano, please.', points: 10 },
    { level: 'Level 2 · shopping', ko: '영수증은 버려 주세요.', en: 'Please throw the receipt away.', points: 20 },
    { level: 'Level 3 · campus', ko: '조별 과제 역할을 어떻게 나눌까요?', en: 'How should we split the group project?', points: 30 },
  ];
  return <div className={styles.practice}>
    <p className={styles.screenTitle}>Today&apos;s missions</p>
    <span className={styles.search}><MagnifyingGlass size={13} />Café, campus, plans…</span>
    {missions.map((mission, index) => <div key={mission.ko} className={styles.missionCard} data-next={index === 0 || undefined}>
      <span className={styles.missionLevel}>{mission.level}</span>
      <span lang="ko" className={styles.missionKo}>{mission.ko}</span>
      <span className={styles.missionEn}>{mission.en}</span>
      <span className={styles.missionPoints}>Up to {mission.points} points<span className={styles.go}>→</span></span>
    </div>)}
  </div>;
}

function VoiceScreen({ phase, seconds, animate }: { phase: Phase; seconds: number; animate: boolean }) {
  return <div className={styles.voice}>
    <div className={styles.missionStrip} data-compact={phase === 'result' || undefined}>
      {phase !== 'result' && <span className={styles.context}>A moment at the café</span>}
      <span lang="ko" className={styles.stripKo}>아이스 아메리카노 한 잔 주세요.</span>
      <span className={styles.missionEn}>One iced Americano, please.</span>
    </div>
    {phase === 'recording' && <div className={styles.recorder}>
      <Wave live />
      <span className={styles.timer}><i className={styles.recDot} />0:0{seconds} <span>/ 0:15</span></span>
      <span className={styles.stop}><b /></span>
      <span className={styles.recLabel}>Recording</span>
    </div>}
    {phase === 'checking' && <div className={styles.recorder}>
      <Wave />
      <span className={styles.checking}>Checking your Korean<span className={styles.dots}><i /><i /><i /></span></span>
      <span className={styles.recLabel}>0:04 recorded</span>
    </div>}
    {phase === 'result' && <div className={styles.score}>
      <span className={styles.scoreLabel}>AI practice feedback</span>
      <span className={styles.scoreNumber}><CountUp to={88} animate={animate} /><small>/100</small></span>
      {[['Pronunciation', 84], ['Accuracy', 96], ['Naturalness', 88]].map(([label, value]) => <span key={label} className={styles.bar}>
        <span>{label}<b>{value}</b></span><i style={{ '--value': `${value}%` } as CSSProperties} />
      </span>)}
      <span className={styles.heard}>We heard <span lang="ko">아이스 아메리카노 한 잔 주세요.</span></span>
      <span className={styles.tip}>Hold the final consonant briefly before the next syllable.</span>
      <span className={styles.earned}><CheckCircle size={15} weight="fill" />+10 points</span>
    </div>}
  </div>;
}

function ConnectionScreen() {
  return <div className={styles.connection}>
    <div className={styles.challenge}>
      <span className={styles.peer}><span className={styles.avatar}>M</span>Minji · speaks Korean</span>
      <span lang="ko" className={styles.stripKo}>이 영화 완전 꿀잼이야.</span>
      <span className={styles.missionEn}>This movie is so much fun.</span>
    </div>
    <div className={styles.reply}><Microphone size={14} weight="fill" /><span className={styles.miniWave}>{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</span>0:05<span className={styles.replyLabel}>Your answer</span></div>
    <div className={styles.rating}>
      <span className={styles.ratingTitle}>Minji rated your answer</span>
      <span className={styles.ratingRow}>Pronunciation<b>★★★★★</b></span>
      <span className={styles.ratingRow}>Naturalness<b>★★★★<s>★</s></b></span>
      <span className={styles.quote}>“Sounds natural! Lean on <span lang="ko">완전</span> a little more.”</span>
      <span className={styles.earned}><CheckCircle size={15} weight="fill" />+27 points</span>
    </div>
  </div>;
}

function ProgressScreen() {
  const days = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Today'];
  return <div className={styles.progressScreen}>
    <p className={styles.screenTitle}>Your speaking journal</p>
    <div className={styles.week}>{days.map((day, index) => <span key={day} data-done={index >= 3 || undefined}><i>{index >= 3 ? '✓' : ''}</i>{day}</span>)}</div>
    <span className={styles.streak}>4-day streak</span>
    <div className={styles.stats}><span><b>7<small>/24</small></b>expressions</span><span><b>12</b>attempts</span><span><b>122</b>points</span></div>
    <div className={styles.milestone}>
      <Sparkle size={20} weight="fill" />
      <span className={styles.milestoneName}>A steady voice</span>
      <i style={{ '--value': `${(122 / 150) * 100}%` } as CSSProperties} />
      <span className={styles.missionEn}>28 points to go</span>
    </div>
    <div className={styles.saved}>
      <span className={styles.savedTitle}>Saved expressions</span>
      <span className={styles.chips}>{['꿀잼', '집콕', '오운완', '한 잔 주세요'].map(word => <span key={word} lang="ko">{word}</span>)}</span>
    </div>
  </div>;
}

function Wave({ live = false }: { live?: boolean }) {
  return <span className={styles.wave} data-live={live || undefined}>{[5, 9, 14, 8, 18, 11, 22, 13, 7, 16, 10, 19, 6, 12].map((height, index) => <i key={index} style={{ '--h': `${height}px`, '--d': `${index * 70}ms` } as CSSProperties} />)}</span>;
}

function CountUp({ to, animate }: { to: number; animate: boolean }) {
  const [value, setValue] = useState(animate ? 0 : to);
  useEffect(() => {
    if (!animate || typeof requestAnimationFrame === 'undefined') return;
    let frame = 0; const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animate, to]);
  return <>{animate ? value : to}</>;
}
