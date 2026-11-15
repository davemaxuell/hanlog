'use client';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { countChars, LIMITS, type ChallengeResponse } from '@/lib/contracts';
import { useAction } from '@/lib/ui/use-action';
import { Button, Stars, StatusNote, TextArea } from '@/components/ui';
export function RatingForm({ responseId, onRated }: { responseId: string; onRated(response: ChallengeResponse): void }) {
  const [pronunciation, setPronunciation] = useState<number | null>(null); const [naturalness, setNaturalness] = useState<number | null>(null); const [comment, setComment] = useState(''); const action = useAction();
  return <form className="hl-stack" onSubmit={async event => { event.preventDefault(); if (!pronunciation || !naturalness || countChars(comment) > LIMITS.comment.max) return; const result = await action.run(() => api.rateResponse(responseId, { pronunciation, naturalness, comment: comment.trim() })); if (result) onRated(result.value); }}><fieldset disabled={action.busy} className="hl-form-fields hl-stack"><Stars label="Pronunciation" value={pronunciation} onChange={setPronunciation} /><Stars label="Naturalness" value={naturalness} onChange={setNaturalness} /><TextArea label="Comment (optional)" value={comment} onChange={event => setComment(event.target.value)} counter={{ value: countChars(comment), max: LIMITS.comment.max }} error={countChars(comment) > LIMITS.comment.max ? 'Keep it to 200 characters.' : undefined} /></fieldset>{action.error && <StatusNote tone="error">{action.error}</StatusNote>}<Button type="submit" busy={action.busy} busyLabel="Sending rating…" disabled={!pronunciation || !naturalness || countChars(comment) > LIMITS.comment.max} className="hl-fit">Send rating</Button></form>;
}
