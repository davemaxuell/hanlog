'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { progressApi } from '@/lib/progress-client';
import type { Attempt, MissionWithProgress } from '@/lib/contracts';
import type { AttemptHistory } from '@/lib/progress-contracts';
import { useApi } from '@/lib/ui/use-api';
import { useSessionExpired } from '@/lib/ui/session-context';
import { Button, Ko, StatusNote } from '@/components/ui';
import styles from './learning.module.css';

function PastAttempt({ attempt, mission }: { attempt: Attempt; mission?: MissionWithProgress }) {
  const { score } = attempt;
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(attempt.createdAt));
  return <details className={styles.historyItem}><summary><span className={styles.historyScore} aria-label={`${score.overall} out of 100`}>{score.overall}</span><span className={styles.historyTitle}><strong>{mission ? <Ko>{mission.korean}</Ko> : 'Speaking practice'}</strong><small><time dateTime={attempt.createdAt}>{date} KST</time> · {score.scoredBy === 'mock' ? 'Demo score' : 'AI practice score'} · {attempt.pointsAwarded ? `+${attempt.pointsAwarded} points` : 'No points this time'}</small></span></summary>
    <div className={styles.historyBody}><p className="hl-caption">{mission?.meaningEn}</p><dl><div><dt>Pronunciation</dt><dd>{score.pronunciation}</dd></div><div><dt>Accuracy</dt><dd>{score.accuracy}</dd></div><div><dt>{mission?.mode === 'use' ? 'Usage' : 'Naturalness'}</dt><dd>{score.usage}</dd></div></dl><div className="hl-stack-sm"><p className="hl-caption">What we heard</p><Ko as="p">{score.heard}</Ko><p>{score.praise}</p></div>
      {score.issues.length > 0 && <ul>{score.issues.map((issue, index) => <li key={index}><Ko>{issue.segment}</Ko><p>{issue.problem}</p><p className="hl-caption">{issue.tip}</p></li>)}</ul>}
      <div className={styles.tip}><strong>Try this next</strong><p>{score.nextTip}</p></div><Link className="hl-button hl-button--secondary hl-fit" href={`/app/missions/${attempt.missionId}`}>Practise again →</Link>
    </div>
  </details>;
}

export function AttemptJournal({ missions, missionId }: { missions: MissionWithProgress[]; missionId?: string }) {
  const first = useApi(() => progressApi.history({ limit: 10, missionId }), [missionId]);
  const [pages, setPages] = useState<AttemptHistory[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const lock = useRef(false); const alive = useRef(true); const sessionExpired = useSessionExpired();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const attempts = [...new Map([...(first.data?.attempts ?? []), ...pages.flatMap(page => page.attempts)].map(attempt => [attempt.id, attempt])).values()];
  const cursor = pages.length ? pages[pages.length - 1].nextCursor : first.data?.nextCursor;
  async function more() {
    if (!cursor || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { const result = await progressApi.history({ cursor, missionId, limit: 10 }); if (alive.current) setPages(previous => [...previous, result]); }
    catch (cause) { if (!alive.current) return; if (cause instanceof ApiClientError && cause.code === 'unauthenticated') sessionExpired(); else setError('We couldn’t load earlier attempts. Your current history is still here.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="hl-stack-sm">
    {first.loading && <p role="status">Opening your practice journal…</p>}
    {first.error && <><StatusNote tone="error">We couldn&apos;t load your practice history.</StatusNote><Button variant="secondary" onClick={first.reload}>Retry history</Button></>}
    {!first.loading && !first.error && (attempts.length ? <ul className={styles.history} aria-label="Past speaking attempts">{attempts.map(attempt => <li key={attempt.id}><PastAttempt attempt={attempt} mission={missions.find(m => m.id === attempt.missionId)} /></li>)}</ul> : <div className={styles.empty}><h2>{missionId ? 'This expression is waiting for your voice.' : 'Your first try starts the story.'}</h2><p>After you speak, your score and practical feedback stay here. Every attempt counts, even when it earns no points.</p><Link className="hl-link-button" href={missionId ? `/app/missions/${missionId}` : '/app/missions'}>Choose a practice →</Link></div>)}
    {error && <StatusNote tone="error">{error}</StatusNote>}
    {cursor && !first.error && <div className="hl-actions"><Button variant="secondary" busy={busy} busyLabel="Loading history…" onClick={() => void more()}>Load earlier attempts</Button></div>}
  </div>;
}
