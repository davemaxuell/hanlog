'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { progressApi } from '@/lib/progress-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { Button, StatusNote } from '@/components/ui';
import { PracticeWeek } from '@/components/mission/PracticeWeek';
import { AttemptJournal } from '@/components/mission/AttemptJournal';
import styles from '@/components/mission/learning.module.css';

export default function ProgressPage() {
  const { user } = useSession(); const [missionId, setMissionId] = useState('');
  const progress = useApi(() => progressApi.summary(), [user.id]);
  const missions = useApi(() => api.listMissions(), [user.id]);
  return <div className={styles.page}><header className={styles.header}><p>Small tries. A growing story.</p><h1>Your speaking journal.</h1><p>Come back to what you said, the feedback you received, and the expressions that are becoming familiar.</p></header>
    {progress.loading && <div className={styles.loading} role="status" aria-label="Loading progress"><span /><span /><span /></div>}
    {progress.error && <div className="hl-stack-sm"><StatusNote tone="error">We couldn&apos;t load your progress summary.</StatusNote><Button variant="secondary" onClick={progress.reload}>Retry progress</Button></div>}
    {progress.data && !progress.error && <><dl className={styles.stats}><div className={styles.stat}><dt>Expressions practised</dt><dd>{progress.data.practicedMissions}<span className="hl-caption"> / {progress.data.totalMissions}</span></dd></div><div className={styles.stat}><dt>Days you showed up</dt><dd>{progress.data.practiceDays}</dd></div><div className={styles.stat}><dt>Speaking attempts</dt><dd>{progress.data.totalAttempts}</dd></div></dl><div className={styles.twoColumns}><section className={styles.panel} aria-labelledby="progress-week"><div className={styles.sectionHeading}><h2 id="progress-week">Your week in words</h2><span>{progress.data.currentStreak} day streak</span></div><PracticeWeek days={progress.data.weeklyActivity} /><p className="hl-caption">Longest streak: {progress.data.longestStreak} {progress.data.longestStreak === 1 ? 'day' : 'days'}. Practice days follow Korea time.</p></section><section className={`${styles.panel} ${styles.peer}`} aria-labelledby="growing-confidence"><h2 id="growing-confidence">Keep the useful words close.</h2><p><strong>{progress.data.savedMissionIds.length}</strong> saved expressions to revisit. <strong>{progress.data.strongMissions}</strong> expressions with a practice result of 80 or more.</p><Link href="/app/missions" className="hl-button hl-button--secondary hl-fit">Open my phrasebook →</Link><p className="hl-caption">Scores help guide practice. They don&apos;t measure all the ways you&apos;re growing.</p></section></div></>}
    <section className="hl-stack" aria-labelledby="history-heading"><div className={styles.sectionHeading}><h2 id="history-heading">Every attempt, remembered.</h2><span className="hl-caption">Open an attempt to revisit its feedback</span></div>{missions.data && <div className={styles.filterRow}><label>Filter history by expression<select value={missionId} onChange={event => setMissionId(event.target.value)}><option value="">All expressions</option>{missions.data.missions.map(mission => <option key={mission.id} value={mission.id}>{mission.meaningEn}</option>)}</select></label></div>}{missions.error && <p className="hl-caption">Expression titles are unavailable, but you can still review your feedback.</p>}<AttemptJournal key={`${user.id}:${missionId}`} missions={missions.data?.missions ?? []} missionId={missionId || undefined} /></section>
  </div>;
}
