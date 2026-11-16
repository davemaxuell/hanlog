'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ApiErrorCode, Mission, User } from '@/lib/contracts';
import { api, ApiClientError } from '@/lib/api-client';
import { errorCopy } from '@/lib/ui/error-copy';
import { MissionFlow } from '@/components/mission/MissionFlow';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
import { Button, Ko, StatusNote, Surface } from '@/components/ui';
import styles from './intro.module.css';
import { IntroReveal } from './IntroReveal';

const consentCopy = 'I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days. I am 14 or older.';
export function TryNow({ mission, convert, deps }: { mission: Mission; convert?: (blob: Blob) => Promise<Uint8Array>; deps?: Partial<RecorderDeps> }) {
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorCode | null>(null);
  const [scored, setScored] = useState(false);
  const user = useRef<User | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const prepare = () => {
    if (user.current) { setReady(true); return; }
    if (pending.current) return;
    setBusy(true); setError(null);
    pending.current = (async () => {
      try {
        const existing = await api.getSession();
        user.current = existing ?? await api.createSession({ nickname: `Guest ${Math.floor(1000 + Math.random() * 9000)}`, role: 'learner' });
        if (alive.current) setReady(true);
      } catch (cause) {
        if (alive.current) setError(cause instanceof ApiClientError ? cause.code : 'internal');
      } finally { pending.current = null; if (alive.current) setBusy(false); }
    })();
  };
  return <IntroReveal id="try" data-section="try" className={styles.section} aria-labelledby="try-heading"><div className={styles.tryPanel}>
    <div className={styles.sectionHead}><p className={styles.eyebrow}>Your first everyday expression</p><h2 id="try-heading">Try it now</h2><p className={styles.muted}>Start with a cafe order. Take your time; you can always try again.</p></div>
    {!consent || !ready ? <Surface tone="apricot"><div className={styles.tryIntro}><Ko className={styles.trySentence}>{mission.korean}</Ko><p>{mission.meaningEn}</p></div></Surface> : null}
    <div><label className={styles.consent}><input type="checkbox" checked={consent} onChange={event => { const checked = event.target.checked; setConsent(checked); if (checked) prepare(); else setScored(false); }} /><span>{consentCopy}</span></label><Link className={styles.textLink} href="/privacy">Read the privacy notice</Link></div>
    {!consent && <p className={styles.muted}>Tick the box to turn on the recorder.</p>}
    {consent && busy && <p role="status" className={styles.tryStatus}>Getting your practice space ready…</p>}
    {consent && error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(error) || errorCopy('internal')}</StatusNote>{error === 'daily_limit' && <p className={styles.muted}>The guest limit can be shared by people on the same network. You can still explore this page.</p>}<div><Button variant="secondary" onClick={prepare}>Try again</Button></div></div>}
    {consent && ready && <div className={styles.tryStageReveal}><MissionFlow mission={mission} convert={convert} deps={deps} onScored={() => setScored(true)} {...{ headingLevel: 2 as const }} /></div>}
    {consent && scored && <div className={styles.keepGoingReveal}><Link className="hl-link-button" href="/app">Keep going in the app</Link></div>}
  </div></IntroReveal>;
}
