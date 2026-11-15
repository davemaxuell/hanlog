'use client';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, MarginRow, StatusNote, Surface } from '@/components/ui';
export default function Rewards() {
  const request = useApi(async () => { const [points, rewards] = await Promise.all([api.getPoints(), api.listRewards()]); return { points, rewards }; }, []);
  if (request.loading) return <StatusNote tone="info">Counting your small wins…</StatusNote>;
  if (request.error || !request.data) return <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(request.error?.code ?? 'internal')}</StatusNote><Button onClick={request.reload}>Try again</Button></div>;
  const { points, rewards } = request.data;
  return <div className="hl-stack"><header className="hl-page-heading"><p className="hl-eyebrow">Every conversation counts</p><h1>Your small wins add up.</h1></header><Surface tone="apricot"><div className="hl-balance"><p className="hl-caption">Your points</p><p className="hl-score-number">{points.balance.toLocaleString()}</p><p>A little progress, saved for later.</p></div></Surface>
    <section aria-labelledby="points-work" className="hl-stack-sm"><MarginRow label="Earn"><h2 id="points-work">How points work</h2></MarginRow><p>Each mission earns points once: up to 10, 20, or 30 for its level.</p><p>Your challenge answers earn points when someone rates them.</p><p>Rating answers and sending helpfulness feedback earn points too.</p></section>
    <section aria-labelledby="rewards-heading" className="hl-stack-sm"><MarginRow label="Look ahead"><h2 id="rewards-heading">Something to work toward</h2></MarginRow><p className="hl-caption">Example rewards. Partners are not confirmed yet.</p><div className="hl-reward-grid">{rewards.map(reward => <article key={reward.id} aria-label={reward.title} className="hl-reward-card"><p className="hl-eyebrow">{reward.category === 'kpop' ? 'K-pop' : reward.category}</p><h3>{reward.title}</h3><p className="hl-caption">{reward.description}</p><p className="hl-reward-cost">{reward.cost.toLocaleString()} points</p><progress aria-label={`Progress toward ${reward.title}`} value={Math.min(points.balance, reward.cost)} max={reward.cost} /><p className="hl-caption">{points.balance >= reward.cost ? 'You have enough points' : `${(reward.cost - points.balance).toLocaleString()} points to go`}</p><Button variant="secondary" disabled>Coming soon</Button></article>)}</div></section>
    <section aria-labelledby="points-history" className="hl-stack-sm"><MarginRow label="Your log"><h2 id="points-history">Points history</h2></MarginRow>{points.events.length ? <ol className="hl-ledger">{points.events.map(event => <li key={event.id}><div className="hl-stack-sm"><p>{event.label}</p><time className="hl-caption" dateTime={event.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(event.createdAt))}</time></div><strong>{event.delta >= 0 ? '+' : ''}{event.delta}</strong></li>)}</ol> : <div className="hl-stack-sm"><p>No points yet. Your first mission is waiting.</p><Link className="hl-back-link" href="/app">Go to missions</Link></div>}</section>
  </div>;
}
