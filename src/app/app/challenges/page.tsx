'use client';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, MarginRow, StatusNote } from '@/components/ui';
import { ChallengeRow } from '@/components/challenge/ChallengeRow';
export default function Challenges() {
  const { user } = useSession(); const korean = user.role === 'korean';
  const request = useApi(async () => {
    const [first, second] = await Promise.all([api.listChallenges(korean ? 'to-rate' : 'open'), api.listChallenges(korean ? 'mine' : 'answered')]);
    const statuses = korean ? {} : Object.fromEntries(await Promise.all(second.map(async challenge => {
      const detail = await api.getChallenge(challenge.id); return [challenge.id, detail?.myResponse?.status === 'rated' ? 'Rated' : 'Waiting for rating'];
    })));
    return { first, second, statuses };
  }, [user.role]);
  const waiting = request.data?.first.reduce((total, item) => total + item.viewer.pendingToRate, 0) ?? 0;
  const firstTitle = korean ? `To rate (${waiting})` : 'Open challenges'; const secondTitle = korean ? 'My challenges' : 'My answers';
  return <div className="hl-stack"><header className="hl-page-heading"><p className="hl-eyebrow">Korean, between people</p><h1>A place to try it out.</h1><p>{korean ? 'Share an expression. Help someone make it their own.' : 'Try everyday expressions with a Korean speaker.'}</p>{korean && <Link className="hl-button hl-button--primary hl-fit" href="/app/challenges/new">Post a challenge</Link>}</header>
    {request.loading && <StatusNote tone="info">Opening the conversation…</StatusNote>}
    {request.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(request.error.code)}</StatusNote><Button onClick={request.reload}>Try again</Button></div>}
    {request.data && !request.loading && !request.error && <><section aria-labelledby="challenges-first" className="hl-stack-sm"><MarginRow label={korean ? 'Give back' : 'Try one'}><h2 id="challenges-first">{firstTitle}</h2></MarginRow>{request.data.first.length ? <div className="hl-mission-list">{request.data.first.map(item => <ChallengeRow key={item.id} challenge={item} />)}</div> : <p className="hl-empty">{korean ? 'Nothing to rate right now.' : 'No open challenges yet. Check back soon.'}</p>}</section><section aria-labelledby="challenges-second" className="hl-stack-sm"><MarginRow label="Your log"><h2 id="challenges-second">{secondTitle}</h2></MarginRow>{request.data.second.length ? <div className="hl-mission-list">{request.data.second.map(item => <ChallengeRow key={item.id} challenge={item} status={request.data!.statuses[item.id]} />)}</div> : <p className="hl-empty">{korean ? 'You have not posted a challenge yet.' : 'You have not answered a challenge yet.'}</p>}</section></>}
  </div>;
}
