'use client';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { progressApi } from '@/lib/progress-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Ko, StatusNote } from '@/components/ui';
import { MissionCard } from '@/components/mission/MissionCard';
import { PracticeWeek } from '@/components/mission/PracticeWeek';
import styles from '@/components/mission/learning.module.css';

export default function Home() {
  const { user } = useSession();
  const missions = useApi(() => api.listMissions(), [user.id]);
  const progress = useApi(() => progressApi.summary(), [user.id]);
  const peer = useApi(() => user.role === 'korean' ? api.listChallenges('to-rate') : Promise.resolve([]), [user.id, user.role]);
  const waiting = peer.data?.reduce((total, item) => total + item.viewer.pendingToRate, 0) ?? 0;
  const next = missions.data?.missions.find(m => m.id === progress.data?.recommendedMissionId)
    ?? missions.data?.missions.find(m => m.bestOverall === null) ?? missions.data?.missions[0];
  const today = missions.data?.today.map(id => missions.data!.missions.find(m => m.id === id)).filter(m => !!m) ?? [];
  return <div className={styles.page}>
    <header className={styles.header}><p>A little Korean, every day</p><h1><Ko>안녕하세요, {user.nickname}</Ko></h1><p>{user.role === 'korean' ? 'A familiar phrase from you can start someone else’s conversation.' : 'Your next conversation starts with one small try.'}</p></header>
    {user.role === 'korean' && <section className={`${styles.panel} ${styles.peer}`} aria-labelledby="peer-today"><div className={styles.sectionHeading}><h2 id="peer-today">Make someone feel heard</h2><Link href="/app/challenges">Open community →</Link></div>{peer.loading ? <p role="status">Checking for new answers…</p> : peer.error ? <><StatusNote tone="error">We couldn&apos;t check your peer answers.</StatusNote><Button variant="secondary" onClick={peer.reload}>Refresh peer answers</Button></> : <p>{waiting ? `${waiting} answers waiting for your rating` : 'No answers waiting right now. Share an expression to start a new exchange.'}</p>}<div className="hl-actions"><Link className="hl-link-button" href="/app/challenges/new">Post a challenge</Link>{waiting > 0 && <Link className="hl-button hl-button--secondary" href="/app/challenges">Rate answers</Link>}</div></section>}
    {missions.loading && <div className={styles.loading} role="status" aria-label="Finding your next words"><span /><span /><span /></div>}
    {missions.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(missions.error.code)}</StatusNote><Button variant="secondary" onClick={missions.reload}>Try again</Button></div>}
    {next && !missions.loading && !missions.error && <section className={styles.hero} aria-labelledby="next-practice"><div className={styles.heroCopy}><p className={styles.heroLabel}>{next.bestOverall === null ? 'YOUR NEXT CONVERSATION' : 'A LITTLE MORE CONFIDENCE'} · LEVEL {next.level}</p><h2 id="next-practice"><Ko>{next.korean}</Ko></h2><p>{next.meaningEn}</p><p className="hl-caption">{next.situationEn}</p><div className="hl-actions"><Link href={`/app/missions/${next.id}`} className="hl-link-button">{next.bestOverall === null ? 'Start a quick practice' : 'Practise this again'} <span aria-hidden="true">→</span></Link></div></div><div className={styles.heroArt} aria-hidden="true"><div className={styles.wave}><i /><i /><i /><i /><i /><i /><i /></div><strong>15 sec</strong><span>A short recording. A little more confidence.</span></div></section>}
    {progress.data && !progress.error && <dl className={styles.stats}><div className={styles.stat}><dt>Expressions practised</dt><dd>{progress.data.practicedMissions}<span className="hl-caption"> / {progress.data.totalMissions}</span></dd></div><div className={styles.stat}><dt>Current day streak</dt><dd>{progress.data.currentStreak}</dd></div><div className={styles.stat}><dt>Speaking attempts</dt><dd>{progress.data.totalAttempts}</dd></div></dl>}
    {progress.error && <div className="hl-stack-sm"><StatusNote tone="error">Your progress is unavailable right now. You can still choose a mission.</StatusNote><Button variant="secondary" onClick={progress.reload}>Retry progress</Button></div>}
    {missions.data && !missions.error && !missions.loading && <section aria-labelledby="today-heading" className="hl-stack-sm"><div className={styles.sectionHeading}><h2 id="today-heading">Today&apos;s missions</h2><span className="hl-caption">Three small openings into your day</span></div>{today.length > 0 ? <ul className={styles.grid}>{today.map(mission => <li key={mission.id}><MissionCard mission={mission} /></li>)}</ul> : <p className="hl-caption">Your mission library is ready whenever you are.</p>}<Link className="hl-back-link" href="/app/missions">Browse all {missions.data.missions.length} →</Link></section>}
    <div className={styles.twoColumns}><section className={styles.panel} aria-labelledby="week-heading"><div className={styles.sectionHeading}><h2 id="week-heading">Keep showing up</h2><Link href="/app/progress">My progress →</Link></div>{progress.data && !progress.error ? <><PracticeWeek days={progress.data.weeklyActivity} /><p className="hl-caption">{progress.data.practicedToday ? 'You made time for your voice today.' : 'One attempt today is enough to keep the habit going.'} Days follow Korea time.</p></> : <p className="hl-caption">Every speaking attempt belongs in your story, including the ones that don&apos;t earn points.</p>}</section><section className={`${styles.panel} ${styles.peer}`} aria-labelledby="peer-heading"><h2 id="peer-heading">Words are better together.</h2><p>Try an expression from a Korean peer. Send a short voice or video reply, then learn from their feedback.</p><Link className="hl-button hl-button--secondary hl-fit" href="/app/challenges">Find a peer challenge →</Link></section></div>
  </div>;
}
