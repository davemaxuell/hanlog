'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { containsHangul, type ChallengeResponse } from '@/lib/contracts';
import { useAction } from '@/lib/ui/use-action';
import { useSession } from '@/lib/ui/session-context';
import { Button, Stars, StatusNote, Surface } from '@/components/ui';
import { MediaPlayer } from './MediaPlayer';
import { RatingForm } from './RatingForm';
function ReportDialog({ busy, error, onCancel, onConfirm }: { busy: boolean; error: string | null; onCancel(): void; onConfirm(): void }) {
  const dialog = useRef<HTMLDialogElement>(null); const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; if (element?.showModal) element.showModal(); else element?.setAttribute('open', ''); cancel.current?.focus(); return () => { if (element?.open && element.close) element.close(); previous?.focus(); }; }, []);
  return <dialog ref={dialog} className="hl-dialog" aria-labelledby="report-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}><div className="hl-stack"><h2 id="report-title">Report this answer?</h2><p>This hides the answer from the challenge and flags it for review.</p>{error && <StatusNote tone="error">{error}</StatusNote>}<div className="hl-actions"><button ref={cancel} type="button" className="hl-button hl-button--secondary" disabled={busy} onClick={onCancel}>Cancel</button><Button busy={busy} busyLabel="Reporting…" onClick={onConfirm}>Yes, report it</Button></div></div></dialog>;
}
export function ResponseCard({ initialResponse, onReported }: { initialResponse: ChallengeResponse; onReported?(): void }) {
  const [response, setResponse] = useState(initialResponse); const [confirm, setConfirm] = useState(false); const [reported, setReported] = useState(false); const action = useAction(); const { refreshBalance } = useSession();
  if (reported) return null;
  return <article aria-label={`Answer from ${response.responder.nickname}`}><Surface className="hl-stack"><div className="hl-section-heading"><h3>Answer from <span lang={containsHangul(response.responder.nickname) ? 'ko' : undefined}>{response.responder.nickname}</span></h3><time className="hl-caption" dateTime={response.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(response.createdAt))}</time></div>
    {response.mediaAvailable ? <MediaPlayer url={api.mediaUrl.response(response.id)} kind={response.mediaKind} label="Answer recording" /> : <StatusNote tone="info">This recording is no longer available.</StatusNote>}
    {response.status === 'pending' ? <RatingForm responseId={response.id} onRated={updated => { setResponse(updated); void refreshBalance(); }} /> : <div className="hl-stack-sm"><StatusNote tone="success">Rated. Thank you.</StatusNote>{response.rating && <><Stars label="Pronunciation" value={response.rating.pronunciation} /><Stars label="Naturalness" value={response.rating.naturalness} />{response.rating.comment && <p lang={containsHangul(response.rating.comment) ? 'ko' : undefined}>{response.rating.comment}</p>}</>}{response.feedback && <div className="hl-feedback-note hl-stack-sm"><h4>Learner feedback</h4><Stars label="Helpfulness" value={response.feedback.helpfulness} />{response.feedback.comment && <p lang={containsHangul(response.feedback.comment) ? 'ko' : undefined}>{response.feedback.comment}</p>}</div>}</div>}
    <Button variant="text" className="hl-fit" onClick={() => setConfirm(true)}>Report</Button>
    {confirm && <ReportDialog busy={action.busy} error={action.error} onCancel={() => setConfirm(false)} onConfirm={() => void action.run(() => api.reportResponse(response.id)).then(result => { if (result) { setConfirm(false); setReported(true); onReported?.(); } })} />}
  </Surface></article>;
}
