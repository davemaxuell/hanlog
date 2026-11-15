'use client';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, CornerMark, Ko, MarginRow, StatusNote, Surface } from '@/components/ui';
import { MissionRow } from '@/components/mission/MissionRow';
export default function Home() {
  const { user } = useSession();
  const request = useApi(async () => { const [missions, challenges] = await Promise.all([api.listMissions(), user.role === 'korean' ? api.listChallenges('to-rate') : Promise.resolve([])]); return { ...missions, challenges }; }, [user.role]);
  const waiting = request.data?.challenges.reduce((total, item) => total + item.viewer.pendingToRate, 0) ?? 0;
  return <div className="hl-stack">
    <header className="hl-page-heading"><p className="hl-eyebrow">A little Korean, every day</p><Ko as="h1">안녕하세요, {user.nickname}</Ko><p>One sentence closer to your next conversation.</p></header>
    {request.loading && <StatusNote tone="info">Finding your next words…</StatusNote>}
    {request.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(request.error.code)}</StatusNote><Button variant="secondary" onClick={request.reload}>Try again</Button></div>}
    {request.data && !request.loading && !request.error && <>
      {user.role === 'korean' && <CornerMark><Surface tone="apricot"><div className="hl-stack-sm"><p className="hl-eyebrow">Make someone feel heard</p><h2>{waiting ? `${waiting} answers waiting for your rating` : 'No answers waiting right now.'}</h2><p>Your everyday Korean can help a learner find their voice.</p><div className="hl-actions"><Link className="hl-button hl-button--primary" href="/app/challenges">Rate answers</Link><Link className="hl-button hl-button--secondary" href="/app/challenges/new">Post a challenge</Link></div></div></Surface></CornerMark>}
      <section aria-labelledby="today-heading" className="hl-stack-sm"><MarginRow label="Today"><div className="hl-section-heading"><h2 id="today-heading">Today&apos;s missions</h2><span className="hl-caption">A few minutes is enough</span></div></MarginRow><div className="hl-mission-list">{request.data.today.map(id => request.data!.missions.find(m => m.id === id)).filter(m => !!m).map(m => <MissionRow key={m.id} mission={m} />)}</div>{request.data.today.length === 0 && <p className="hl-caption">Choose a mission below to get started.</p>}</section>
      <section aria-labelledby="all-missions-heading" className="hl-stack"><MarginRow label="Explore"><h2 id="all-missions-heading">All missions</h2></MarginRow>{([1, 2, 3] as const).map(level => <div key={level} className="hl-stack-sm"><div className="hl-section-heading"><h3>Level {level}</h3><span className="hl-caption">{level === 1 ? 'Everyday beginnings' : level === 2 ? 'A little more to say' : 'Make it your own'} · up to {level * 10} points</span></div><div className="hl-mission-list">{request.data!.missions.filter(m => m.level === level).map(m => <MissionRow key={m.id} mission={m} />)}</div></div>)}</section>
    </>}
  </div>;
}
