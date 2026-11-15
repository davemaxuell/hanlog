'use client';
import Link from 'next/link';
import { Sparkle, CheckCircle } from '@phosphor-icons/react';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote, Surface } from '@/components/ui';
import styles from './points.module.css';
const milestones = [{ name:'First words', points:10 }, { name:'Finding your flow', points:50 }, { name:'A steady voice', points:150 }, { name:'Conversation builder', points:300 }];
export default function Rewards() {
  const request = useApi(() => api.getPoints(), []);
  if (request.loading) return <StatusNote tone="info">Counting your small wins…</StatusNote>;
  if (request.error || !request.data) return <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(request.error?.code ?? 'internal')}</StatusNote><Button onClick={request.reload}>Try again</Button></div>;
  const points = request.data;
  return <div className="hl-stack"><header className="hl-page-heading"><p className="hl-eyebrow">Keep showing up</p><h1>Small wins add up.</h1><p>A record of the practice and encouragement you put into HanLog.</p></header>
    <div className={styles.overview}><Surface tone="apricot"><div className="hl-balance"><Sparkle size={34} weight="duotone" aria-hidden="true" /><p className="hl-caption">Your points</p><p className="hl-score-number">{points.balance.toLocaleString()}</p><p>Earned through practice and peer exchanges.</p></div></Surface><div className={styles.explainer}><h2>Effort you can see.</h2><p>Each mission has a points cap of 10, 20, or 30. A stronger attempt can earn the difference up to that cap; repeating the same result does not earn points again.</p><p>Peer ratings and helpfulness feedback count too. Points are participation milestones, not a language qualification or money.</p><Link className="hl-link-button" href="/app/missions">Find your next mission →</Link></div></div>
    <section className="hl-stack-sm" aria-labelledby="milestones-heading"><h2 id="milestones-heading">Your milestones</h2><div className={styles.milestones}>{milestones.map(item => {
      const reached = points.balance >= item.points;
      return <article key={item.name} aria-label={item.name} className={`${styles.milestone} ${reached ? styles.reached : ''}`}><span className={styles.milestoneIcon}>{reached ? <CheckCircle size={28} weight="fill" aria-hidden="true" /> : <Sparkle size={28} aria-hidden="true" />}</span><h3>{item.name}</h3><p>{item.points} points</p><progress value={Math.min(points.balance,item.points)} max={item.points} aria-label={`Progress toward ${item.name}`} /><span>{reached ? 'Milestone reached' : `${item.points-points.balance} points to go`}</span></article>;
    })}</div><p className="hl-caption">Partner rewards and redemption are not available. These milestones celebrate your participation.</p></section>
    <section aria-labelledby="points-history" className="hl-stack-sm"><div className="hl-section-heading"><h2 id="points-history">Points history</h2><Link href="/app/progress">See my practice journal →</Link></div>{points.events.length ? <ol className="hl-ledger">{points.events.map(event => <li key={event.id}><div className="hl-stack-sm"><p>{event.label}</p><time className="hl-caption" dateTime={event.createdAt}>{new Intl.DateTimeFormat(undefined,{ dateStyle:'medium' }).format(new Date(event.createdAt))}</time></div><strong>{event.delta>=0?'+':''}{event.delta}</strong></li>)}</ol> : <div className="hl-empty hl-stack-sm"><p>No points yet. Your first mission is waiting.</p><Link className="hl-back-link" href="/app/missions">Go to missions</Link></div>}</section>
  </div>;
}
