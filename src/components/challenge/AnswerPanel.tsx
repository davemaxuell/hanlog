'use client';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { containsHangul, type Challenge, type ChallengeResponse } from '@/lib/contracts';
import { useAction } from '@/lib/ui/use-action';
import { useSession } from '@/lib/ui/session-context';
import { Button, Stars, StatusNote, Surface } from '@/components/ui';
import { Recorder } from '@/components/recorder/Recorder';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
import { MediaPlayer } from './MediaPlayer';
import { FeedbackForm } from './FeedbackForm';
export function AnswerPanel({ challenge, initialResponse, recorderDeps }: { challenge: Challenge; initialResponse: ChallengeResponse | null; recorderDeps?: Partial<RecorderDeps> }) {
  const [updated, setResponse] = useState<ChallengeResponse | null>(null); const [replacing, setReplacing] = useState(false); const [sent, setSent] = useState(false); const action = useAction(); const { user, refreshBalance } = useSession();
  const response = updated?.feedback ? updated : initialResponse?.status === 'rated' ? initialResponse : updated ?? initialResponse;
  const canRecord = user.role === 'learner';
  return <section id={response ? `response-${response.id}` : undefined} tabIndex={-1} aria-label="Your answer" className="hl-stack">{sent && <StatusNote tone="success">{challenge.isSample ? 'Sent. A Korean-speaking peer can now rate it.' : `Sent. ${challenge.author.nickname} will rate it.`}</StatusNote>}
    {canRecord && (!response || (replacing && response.status === 'pending')) ? <div className="hl-stack-sm"><h2>{replacing ? 'Try your answer again.' : 'Your turn to say it.'}</h2><Recorder modes={['audio', 'video']} submitLabel="Send answer" busy={action.busy} busyLabel="Sending answer…" deps={recorderDeps} onSubmit={async recording => { const result = await action.run(() => api.submitResponse(challenge.id, { blob: recording.blob, kind: recording.kind, durationMs: recording.durationMs })); if (result) { setResponse(result.value); setReplacing(false); setSent(true); } }} /><p className="hl-caption">{challenge.isSample ? 'Korean-speaking peers can play and rate your answer.' : 'The challenge author can play and rate your answer.'} Recordings are stored for up to 14 days.</p>{replacing && <Button variant="text" disabled={action.busy} onClick={() => setReplacing(false)}>Keep my current answer</Button>}</div> : response ? <Surface className="hl-stack">{response.mediaAvailable ? <MediaPlayer url={api.mediaUrl.response(response.id)} kind={response.mediaKind} label="Your recording" /> : <StatusNote tone="info">This recording is no longer available.</StatusNote>}{response.status === 'pending' ? <><p>Waiting for a rating.</p>{canRecord ? <Button className="hl-fit" variant="secondary" onClick={() => { setReplacing(true); setSent(false); }}>Record again</Button> : <p className="hl-caption">Switch to the learner role in your profile to replace this answer.</p>}</> : <><h2>Your rating</h2>{response.rating && <div className="hl-stack-sm"><Stars label="Pronunciation" value={response.rating.pronunciation} /><Stars label="Naturalness" value={response.rating.naturalness} />{response.rating.comment && <p lang={containsHangul(response.rating.comment) ? 'ko' : undefined}>{response.rating.comment}</p>}</div>}{response.feedback ? <StatusNote tone="success">Thanks. Your feedback was sent.</StatusNote> : <FeedbackForm responseId={response.id} onFeedback={updated => { setResponse(updated); void refreshBalance(); }} />}</>}</Surface> : <StatusNote tone="info">Choose the learner role in your profile to send an answer.</StatusNote>}
    {action.error && <StatusNote tone="error">{action.error}</StatusNote>}
  </section>;
}
