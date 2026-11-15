'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { communityApi } from '@/lib/community-client';
import { containsHangul, type ChallengeResponse } from '@/lib/contracts';
import { useApi } from '@/lib/ui/use-api';
import { useAction } from '@/lib/ui/use-action';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Ko, StatusNote, Surface } from '@/components/ui';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
import { AnswerPanel } from './AnswerPanel';
import { MediaPlayer } from './MediaPlayer';
import { ResponseCard } from './ResponseCard';
import { SharePanel } from './SharePanel';
import { ReportDialog } from './ReportDialog';
import { useReportAction } from './use-report-action';
import styles from './community.module.css';

function AnswersList({ challengeId, responses, nextCursor }: { challengeId: string; responses: ChallengeResponse[]; nextCursor?: string | null }) {
  const [reported, setReported] = useState<string[]>([]); const heading = useRef<HTMLHeadingElement>(null);
  const [extra, setExtra] = useState<ChallengeResponse[]>([]); const [cursor, setCursor] = useState<string | null | undefined>(); const action = useAction();
  useEffect(() => { if (reported.length) heading.current?.focus(); }, [reported.length]);
  const remaining = [...new Map([...extra, ...responses].map(response => [response.id, response])).values()].filter(response => !reported.includes(response.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const next = cursor === undefined ? nextCursor : cursor;
  return <section aria-labelledby="answers-title" className="hl-stack"><h2 id="answers-title" tabIndex={-1} ref={heading}>Answers</h2>{reported.length > 0 && <StatusNote tone="success">Answer reported.</StatusNote>}{remaining.length ? remaining.map(response => <ResponseCard key={response.id} initialResponse={response} onReported={() => setReported(previous => [...previous, response.id])} />) : <p className="hl-empty">{reported.length ? 'No answers to review right now.' : 'No answers yet. Share your challenge to start a conversation.'}</p>}
    {next && <Button variant="secondary" className="hl-fit" busy={action.busy} onClick={() => void action.run(() => communityApi.listResponses(challengeId, next)).then(result => { if (result) { setExtra(old => [...old, ...result.value.responses]); setCursor(result.value.nextCursor); } })}>More answers</Button>}
    {action.error && <StatusNote tone="error">{action.error}</StatusNote>}
  </section>;
}
type DetailProps = { recorderDeps?: Partial<RecorderDeps>; focusedResponseId?: string };
export function ChallengeDetailPage(props: DetailProps) {
  const { id } = useParams<{ id: string }>();
  return <ChallengeConversation key={id} id={id} {...props} />;
}
function ChallengeConversation({ id, recorderDeps, focusedResponseId }: DetailProps & { id: string }) {
  const { user } = useSession(); const request = useApi(() => communityApi.getChallenge(id, focusedResponseId), [id, user.role, focusedResponseId]);
  const [reporting, setReporting] = useState(false); const [reported, setReported] = useState(false); const reportAction = useReportAction();
  const focused = useRef<string | null>(null);
  useEffect(() => {
    if (!request.data || !focusedResponseId || focused.current === focusedResponseId) return;
    const answer = document.getElementById(`response-${focusedResponseId}`);
    if (answer) { answer.focus(); focused.current = focusedResponseId; }
  }, [request.data, focusedResponseId]);
  if (reported) return <div className="hl-stack"><h1>Challenge reported.</h1><p>Report recorded. Hidden from your feed.</p><Link className="hl-link-button hl-fit" href="/app/challenges">Back to challenges</Link></div>;
  if (request.loading && !request.data) return <StatusNote tone="info">Opening this challenge…</StatusNote>;
  if (!request.data) return <div className="hl-stack"><StatusNote tone="error">{errorCopy(request.error?.code ?? 'not_found')}</StatusNote><Button onClick={request.reload}>Try again</Button><Link className="hl-back-link" href="/app/challenges">Back to challenges</Link></div>;
  const { challenge, viewerRole, responses, myResponse, responsesNextCursor } = request.data; const canRate = viewerRole === 'author' || viewerRole === 'rater';
  return <div className="hl-stack"><div className="hl-section-heading"><Link className="hl-back-link" href="/app/challenges">← Challenges</Link><Button variant="text" busy={request.loading} busyLabel="Refreshing…" onClick={request.reload}>Refresh conversation</Button></div>
    {request.error && <StatusNote tone="error">The conversation could not refresh. Your draft is still here. {errorCopy(request.error.code)}</StatusNote>}
    <header className={styles.detailIntro}><div className={styles.detailHeading}><p className="hl-eyebrow">From <span lang={containsHangul(challenge.author.nickname) ? 'ko' : undefined}>{challenge.author.nickname}</span>{challenge.isSample && <span className="hl-sample-label">Sample</span>}</p><Ko as="h1" className="hl-mission-expression">{challenge.korean}</Ko><p className="hl-meaning">{challenge.meaningEn}</p></div><span className="hl-points">Voice or video · 15 seconds</span></header>
    {challenge.situationEn && <Surface><div className="hl-stack-sm"><h2 className="hl-note-heading">Where to say it</h2><p>{challenge.situationEn}</p></div></Surface>}
    {challenge.hasReference && <MediaPlayer url={api.mediaUrl.reference(challenge.id)} kind="audio" label={`${challenge.author.nickname}'s reference`} />}
    {canRate ? <AnswersList key={challenge.id} challengeId={challenge.id} responses={responses} nextCursor={responsesNextCursor} /> : viewerRole === 'responder' || user.role === 'learner' ? <AnswerPanel key={challenge.id} challenge={challenge} initialResponse={myResponse} recorderDeps={recorderDeps} /> : <StatusNote tone="info">Only the author can rate answers to this challenge.</StatusNote>}
    {viewerRole === 'author' && <SharePanel code={challenge.code} />}
    <div className={styles.detailActions}>{viewerRole !== 'author' && <Button variant="text" className="hl-fit" onClick={() => setReporting(true)}>Report challenge</Button>}<Link className="hl-back-link" href="/app/challenges">Find another expression</Link></div>
    {reporting && <ReportDialog kind="challenge" busy={reportAction.busy} error={reportAction.error} onCancel={() => setReporting(false)} onConfirm={reason => void reportAction.run(() => communityApi.reportChallenge(challenge.id, reason)).then(result => { if (result) { setReporting(false); setReported(true); } })} />}
  </div>;
}
