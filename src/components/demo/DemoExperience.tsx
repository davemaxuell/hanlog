'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, ArrowsOut, ArrowsIn, Microphone, ArrowCounterClockwise, CheckCircle, SlidersHorizontal } from '@phosphor-icons/react';
import type { AttemptResult, Mission } from '@/lib/contracts';
import type { SampleChallenge } from '@/lib/content';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button, Ko } from '@/components/ui';
import { LivePractice } from './LivePractice';
import { DemoPreparation } from './DemoPreparation';
import { DemoFeedback } from './DemoFeedback';
import { DemoConnection } from './DemoConnection';
import { DemoProgress } from './DemoProgress';
import styles from './demo.module.css';

const scenes = ['Practice', 'Feedback', 'People', 'Progress'] as const;
type Mode = 'example' | 'live';
export function DemoExperience({ mission, challenge, missionCount }: { mission: Mission; challenge: SampleChallenge; missionCount: number }) {
  const [mode, setMode] = useState<Mode>('example'); const [scene, setScene] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null); const [active, setActive] = useState(false);
  const [preparing, setPreparing] = useState(false); const [offline, setOffline] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [fullscreen, setFullscreen] = useState(false); const [canFullscreen, setCanFullscreen] = useState(false); const [screenError, setScreenError] = useState('');
  const shell = useRef<HTMLDivElement>(null); const stage = useRef<HTMLElement>(null); const setupDialog = useRef<HTMLDialogElement>(null); const setupButton = useRef<HTMLButtonElement>(null);
  const previousScene = useRef('example-0');
  const canVisit = useCallback((index: number) => !(mode === 'live' && !result && (index === 1 || index === 3)), [mode, result]);
  const go = useCallback((index: number) => { if (!active && !preparing && index >= 0 && index < scenes.length && canVisit(index)) setScene(index); }, [active, preparing, canVisit]);
  const scored = useCallback((value: AttemptResult) => { setResult(value); setActive(false); setScene(1); }, []);
  useEffect(() => {
    const network = () => setOffline(!navigator.onLine);
    const expanded = () => setFullscreen(document.fullscreenElement === shell.current);
    network(); setCanFullscreen(!!document.fullscreenEnabled && typeof shell.current?.requestFullscreen === 'function');
    window.addEventListener('online', network); window.addEventListener('offline', network); document.addEventListener('fullscreenchange', expanded);
    return () => { window.removeEventListener('online', network); window.removeEventListener('offline', network); document.removeEventListener('fullscreenchange', expanded); };
  }, []);
  useEffect(() => {
    const currentScene = `${mode}-${scene}`;
    if (previousScene.current === currentScene) return;
    previousScene.current = currentScene;
    stage.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
    shell.current?.scrollTo?.({ top: 0, behavior: 'instant' });
  }, [scene, mode]);
  useEffect(() => { if (preparing) setupDialog.current?.showModal(); }, [preparing]);
  useEffect(() => {
    if (!result) return;
    const changed = (event: StorageEvent) => {
      if (event.key !== 'hl_session_changed') return;
      setResult(null); setScene(0); setMode('example');
      setProfileNotice('The profile in another tab changed. This walkthrough has been reset; account history has not been deleted.');
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [result]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || active || preparing) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, button, a, audio, video, [contenteditable="true"], [role="slider"], dialog')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); go(scene + (event.key === 'ArrowRight' ? 1 : -1)); }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, [active, preparing, go, scene]);
  function changeMode(next: Mode) { if (active || preparing || next === mode) return; setMode(next); setScene(0); setProfileNotice(''); }
  function restart() { if (active || preparing) return; setScene(0); setMode('example'); setResult(null); setScreenError(''); setProfileNotice(''); stage.current?.focus({ preventScroll: true }); }
  function closeSetup() { setupDialog.current?.close(); setPreparing(false); setupButton.current?.focus(); }
  async function expand() {
    setScreenError('');
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); }
    catch { setScreenError('Full screen is unavailable here. You can keep presenting in this window.'); }
  }
  return <div ref={shell} className={styles.shell}>
    <a className="hl-skip-link" href="#demo-stage">Skip to walkthrough</a>
    <header className={styles.header}>
      <Link href="/" prefetch={false} className={styles.brand}><BrandMark />HanLog <span lang="ko">한록</span></Link>
      <span className={styles.headerNote}>A little Korean. A real connection.</span>
      <div className={styles.tools}>
        <button ref={setupButton} type="button" disabled={active} onClick={() => setPreparing(true)}><SlidersHorizontal size={18} aria-hidden="true" />Prepare demo</button>
        {canFullscreen && <button type="button" onClick={() => void expand()}>{fullscreen ? <ArrowsIn size={18} aria-hidden="true" /> : <ArrowsOut size={18} aria-hidden="true" />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>}
      </div>
    </header>
    <h1 className={styles.srOnly}>HanLog product walkthrough</h1>
    <div className={styles.modeRow}>
      <div className={styles.modeSwitch} role="group" aria-label="Walkthrough mode">
        <button type="button" aria-pressed={mode === 'example'} disabled={active} onClick={() => changeMode('example')}>Example walkthrough</button>
        <button type="button" aria-pressed={mode === 'live'} disabled={active} onClick={() => changeMode('live')}><Microphone size={16} aria-hidden="true" />Live practice</button>
      </div>
      <p className={styles.modeNote}>{mode === 'example' ? 'Illustrative scenes · no AI requests' : 'Your voice · actual practice feedback'}</p>
    </div>
    {screenError && <p className={styles.notice} role="status">{screenError}</p>}
    {profileNotice && <p className={styles.notice} role="status">{profileNotice}</p>}
    {offline && <p className={styles.notice} role="status">You&apos;re offline. The example walkthrough remains available in this loaded tab; live practice needs a connection.</p>}
    <nav className={styles.scenes} aria-label="Walkthrough scenes">{scenes.map((name, index) => <button type="button" key={name} aria-current={scene === index ? 'step' : undefined} disabled={active || !canVisit(index)} onClick={() => go(index)}><span aria-hidden="true">0{index + 1}</span>{name}</button>)}</nav>
    <main id="demo-stage" ref={stage} tabIndex={-1} className={styles.stage} aria-label={`Scene ${scene + 1} of 4: ${scenes[scene]}`}>
      <div key={`${mode}-${scene}`} className={styles.sceneContent}>
        {scene === 0 && <div className={`${styles.practice} ${mode === 'live' ? styles.practiceLive : ''}`}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>From knowing the words to using them</p>
            <h2>One phrase can open a conversation.</h2>
            <p className={styles.lead}>A café order today. A conversation tomorrow. Practise the Korean you actually want to say.</p>
            <div className={styles.facts}><p><strong>15s</strong><span>to say something</span></p><p><strong>{missionCount}</strong><span>everyday expressions</span></p></div>
            {mode === 'live' && <p className={styles.liveContext}>{mission.situationEn}</p>}
          </div>
          {mode === 'example' ? <div className={styles.window}>
            <div className={styles.arch} aria-hidden="true"><span className={styles.sun} /><span className={styles.star}>✦</span><div className={styles.mullion} /></div>
            <div className={styles.expression}>
              <p className={styles.context}>A moment at the café</p>
              <Ko as="p" className={styles.phrase}>{mission.korean}</Ko>
              <p className={styles.meaning}>{mission.meaningEn}</p>
              <div className={styles.phraseFooter}><Microphone size={25} weight="fill" aria-hidden="true" /><span>Speak → get feedback → try again</span></div>
            </div>
            <p className={styles.exampleCaption}>Example walkthrough. Try Live practice to use your own voice.</p>
          </div> : <div className={styles.liveWindow}>{result ? <div className={styles.completed}><CheckCircle size={48} weight="fill" aria-hidden="true" /><h3>Your practice is saved.</h3><p>You can revisit this result without submitting another recording.</p><Button onClick={() => go(1)}>View my result</Button></div> : <LivePractice mission={mission} onScored={scored} onActivityChange={setActive} />}</div>}
        </div>}
        {scene === 1 && <DemoFeedback mission={mission} result={result} mode={mode} />}
        {scene === 2 && <DemoConnection challenge={challenge} />}
        {scene === 3 && <DemoProgress mission={mission} result={result} mode={mode} />}
      </div>
    </main>
    {mode === 'live' && <aside className={styles.fallback}><a href="/demo" target="_blank" rel="noopener noreferrer">Open example in a new tab <ArrowUpRight size={16} aria-hidden="true" /></a><span>{active ? 'A submitted live request may still finish in this tab.' : 'A ready alternative if the venue connection gets in the way.'}</span></aside>}
    <footer className={styles.footer}>
      <div><button type="button" className={styles.restart} disabled={active} onClick={restart}><ArrowCounterClockwise size={17} aria-hidden="true" />Restart walkthrough</button><p>Resets this view. Saved practice stays.</p></div>
      <div className={styles.stepControls}><Button variant="secondary" disabled={active || scene === 0 || !canVisit(scene - 1)} onClick={() => go(scene - 1)}><ArrowLeft size={18} aria-hidden="true" />Back</Button><span className={styles.stepCount} aria-live="polite">{scene + 1} / 4</span>{scene < 3 ? <Button disabled={active || !canVisit(scene + 1)} onClick={() => go(scene + 1)}>Next: {scenes[scene + 1]}<ArrowRight size={18} aria-hidden="true" /></Button> : <a className="hl-link-button" href={mode === 'live' && result ? '/app/progress' : '/#try'} target="_blank" rel="noopener noreferrer">{mode === 'live' && result ? 'Open my progress' : 'Try HanLog'}<ArrowUpRight size={18} aria-hidden="true" /></a>}</div>
    </footer>
    <p className={styles.keyboardHint}>Use ← → to move between scenes when you&apos;re not recording or using a control.</p>
    {preparing && <dialog ref={setupDialog} className={`hl-dialog ${styles.setup}`} aria-label="Prepare your demo" onCancel={event => { event.preventDefault(); closeSetup(); }}><DemoPreparation onClose={closeSetup} /></dialog>}
  </div>;
}
