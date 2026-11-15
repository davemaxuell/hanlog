'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import type { ChallengeResponse } from '@/lib/contracts';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, CornerMark, Ko, MarginRow, StatusNote, Surface } from '@/components/ui';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
import { AnswerPanel } from './AnswerPanel';
import { MediaPlayer } from './MediaPlayer';
import { ResponseCard } from './ResponseCard';
function AnswersList({ responses }: { responses: ChallengeResponse[] }) {
  const [reported, setReported] = useState<string[]>([]); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (reported.length) heading.current?.focus(); }, [reported.length]);
  const remaining = responses.filter(response => !reported.includes(response.id));
  return <section aria-labelledby="answers-title" className="hl-stack"><MarginRow label="Listen"><h2 id="answers-title" tabIndex={-1} ref={heading}>Answers</h2></MarginRow>{reported.length > 0 && <StatusNote tone="success">Answer reported.</StatusNote>}{remaining.length ? remaining.map(response => <ResponseCard key={response.id} initialResponse={response} onReported={() => setReported(previous => [...previous, response.id])} />) : <p className="hl-empty">{reported.length ? 'No answers to review right now.' : 'No answers yet. Share your challenge to start a conversation.'}</p>}</section>;
}
export function ChallengeDetailPage({ recorderDeps }: { recorderDeps?: Partial<RecorderDeps> }) {
  const { id } = useParams<{ id: string }>(); const { user } = useSession(); const request = useApi(() => api.getChallenge(id), [id, user.role]);
  if (request.loading) return <StatusNote tone="info">Opening this challenge…</StatusNote>;
  if (request.error || !request.data) return <div className="hl-stack"><StatusNote tone="error">{errorCopy(request.error?.code ?? 'not_found')}</StatusNote><Button onClick={request.reload}>Try again</Button><Link className="hl-back-link" href="/app/challenges">Back to challenges</Link></div>;
  const { challenge, viewerRole, responses, myResponse } = request.data; const canRate = viewerRole === 'author' || viewerRole === 'rater';
  return <div className="hl-stack"><Link className="hl-back-link" href="/app/challenges">← Challenges</Link><MarginRow label="Try this"><header className="hl-stack-sm"><p className="hl-eyebrow">From {challenge.author.nickname}{challenge.isSample && <span className="hl-sample-label">Sample</span>}</p><Ko as="h1" className="hl-mission-expression">{challenge.korean}</Ko><p className="hl-meaning">{challenge.meaningEn}</p></header></MarginRow>
    {challenge.situationEn && <CornerMark><Surface tone="apricot"><div className="hl-stack-sm"><h2 className="hl-note-heading">Where to say it</h2><p>{challenge.situationEn}</p></div></Surface></CornerMark>}
    {challenge.hasReference && <MediaPlayer url={api.mediaUrl.reference(challenge.id)} kind="audio" label={`${challenge.author.nickname}'s reference`} />}
    {canRate ? <AnswersList responses={responses} /> : viewerRole === 'responder' || user.role === 'learner' ? <AnswerPanel key={challenge.id} challenge={challenge} initialResponse={myResponse} recorderDeps={recorderDeps} /> : <StatusNote tone="info">Only the author can rate answers to this challenge.</StatusNote>}
  </div>;
}
