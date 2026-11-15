'use client';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { communityApi } from '@/lib/community-client';
import { containsHangul, type ChallengeResponse } from '@/lib/contracts';
import { useSession } from '@/lib/ui/session-context';
import { Button, Stars, StatusNote, Surface } from '@/components/ui';
import { MediaPlayer } from './MediaPlayer';
import { RatingForm } from './RatingForm';
import { ReportDialog } from './ReportDialog';
import { useReportAction } from './use-report-action';
export function ResponseCard({ initialResponse, onReported }: { initialResponse: ChallengeResponse; onReported?(): void }) {
  const [updated, setResponse] = useState<ChallengeResponse | null>(null); const [confirm, setConfirm] = useState(false); const [reported, setReported] = useState(false); const action = useReportAction(); const { refreshBalance } = useSession();
  const response = initialResponse.feedback ? initialResponse : updated ?? initialResponse;
  if (reported) return null;
  return <article id={`response-${response.id}`} tabIndex={-1} aria-label={`Answer from ${response.responder.nickname}`}><Surface className="hl-stack"><div className="hl-section-heading"><h3>Answer from <span lang={containsHangul(response.responder.nickname) ? 'ko' : undefined}>{response.responder.nickname}</span></h3><time className="hl-caption" dateTime={response.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(response.createdAt))}</time></div>
    {response.mediaAvailable ? <MediaPlayer url={api.mediaUrl.response(response.id)} kind={response.mediaKind} label="Answer recording" /> : <StatusNote tone="info">This recording is no longer available.</StatusNote>}
    {response.status === 'pending' ? <RatingForm responseId={response.id} onRated={updated => { setResponse(updated); void refreshBalance(); }} /> : <div className="hl-stack-sm"><StatusNote tone="success">Rated. Thank you.</StatusNote>{response.rating && <><Stars label="Pronunciation" value={response.rating.pronunciation} /><Stars label="Naturalness" value={response.rating.naturalness} />{response.rating.comment && <p lang={containsHangul(response.rating.comment) ? 'ko' : undefined}>{response.rating.comment}</p>}</>}{response.feedback && <div className="hl-feedback-note hl-stack-sm"><h4>Learner feedback</h4><Stars label="Helpfulness" value={response.feedback.helpfulness} />{response.feedback.comment && <p lang={containsHangul(response.feedback.comment) ? 'ko' : undefined}>{response.feedback.comment}</p>}</div>}</div>}
    <Button variant="text" className="hl-fit" onClick={() => setConfirm(true)}>Report</Button>
    {confirm && <ReportDialog busy={action.busy} error={action.error} onCancel={() => setConfirm(false)} onConfirm={reason => void action.run(() => communityApi.reportResponse(response.id, reason)).then(result => { if (result) { setConfirm(false); setReported(true); onReported?.(); } })} />}
  </Surface></article>;
}
