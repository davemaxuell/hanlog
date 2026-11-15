'use client';
import Link from 'next/link';
import type { AttemptResult, Mission } from '@/lib/contracts';
import { Button, Ko, MarginRow, Meter, Surface } from '@/components/ui';
import styles from './learning.module.css';
export function ScoreCard({ result, mission, onRetry, nextHref }: { result: AttemptResult; mission: Mission; onRetry(): void; nextHref?: string }) {
  const { score, pointsAwarded } = result.attempt;
  return <section aria-label="Your score" className="hl-score-card hl-stack">
    <Surface className="hl-stack">
      <div className="hl-score-heading"><div><p className="hl-caption">Overall score</p><h2 className="hl-score-number">{score.overall}</h2><p className="hl-caption">Practice feedback · out of 100</p></div>{score.scoredBy === 'mock' && <span className="hl-demo-badge">Demo scoring, not AI</span>}</div>
      <div className="hl-stack-sm"><Meter label="Pronunciation" value={score.pronunciation} /><Meter label="Accuracy" value={score.accuracy} /><Meter label={mission.mode === 'repeat' ? 'Naturalness' : 'Usage'} value={score.usage} /></div>
      <div className="hl-stack-sm"><p className="hl-caption">We heard:</p><Ko as="p" className="hl-heard">{score.heard}</Ko><p>{score.praise}</p></div>
      {score.issues.length > 0 && <ul className="hl-issue-list">{score.issues.slice(0, 3).map((issue, index) => <li key={index} className="hl-stack-sm"><Ko className="hl-issue-segment">{issue.segment}</Ko><p>{issue.problem}</p><p className="hl-caption">{issue.tip}</p></li>)}</ul>}
      <div className="hl-next-tip"><p className="hl-section-title">For your next try</p><p>{score.nextTip}</p></div>
      <div className={styles.resultSummary}><p>Personal best<strong>{result.bestOverall} / 100</strong></p><p>Attempts left today<strong>{result.attemptsLeftToday}</strong></p><p>My points<strong>{result.balance}</strong></p></div>
    </Surface>
    <MarginRow label="Points" marker={pointsAwarded > 0 ? 'filled' : 'empty'}><p className="hl-earned">{pointsAwarded > 0 ? `+${pointsAwarded} points` : score.overall >= 50 ? 'Already earned for this mission.' : 'No points this time. Scores of 50 and above earn points.'}</p></MarginRow>
    {result.attemptsLeftToday === 0 && <p className="hl-caption">You&apos;ve used today&apos;s speaking attempts. Your feedback is saved; come back tomorrow for another try.</p>}
    <div className="hl-actions"><Button variant="secondary" disabled={result.attemptsLeftToday === 0} onClick={onRetry}>Try again</Button>{nextHref && <><Link className="hl-link-button" href={nextHref}>Next mission</Link><Link className="hl-back-link" href="/app/progress">Review my practice</Link></>}</div>
  </section>;
}
