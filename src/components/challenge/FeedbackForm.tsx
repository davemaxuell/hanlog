'use client';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { countChars, LIMITS, type ChallengeResponse } from '@/lib/contracts';
import { useAction } from '@/lib/ui/use-action';
import { Button, Stars, StatusNote, TextArea } from '@/components/ui';
export function FeedbackForm({ responseId, onFeedback }: { responseId: string; onFeedback(response: ChallengeResponse): void }) {
  const [helpfulness, setHelpfulness] = useState<number | null>(null); const [comment, setComment] = useState(''); const action = useAction();
  return <form className="hl-stack" onSubmit={async event => { event.preventDefault(); if (!helpfulness || countChars(comment) > LIMITS.comment.max) return; const result = await action.run(() => api.giveFeedback(responseId, { helpfulness, comment: comment.trim() })); if (result) onFeedback(result.value); }}><fieldset disabled={action.busy} className="hl-form-fields hl-stack"><Stars label="Was this rating helpful?" value={helpfulness} onChange={setHelpfulness} /><TextArea label="Comment (optional)" value={comment} onChange={event => setComment(event.target.value)} counter={{ value: countChars(comment), max: LIMITS.comment.max }} error={countChars(comment) > LIMITS.comment.max ? 'Keep it to 200 characters.' : undefined} /></fieldset>{action.error && <StatusNote tone="error">{action.error}</StatusNote>}<Button type="submit" busy={action.busy} busyLabel="Sending feedback…" disabled={!helpfulness || countChars(comment) > LIMITS.comment.max} className="hl-fit">Send feedback</Button></form>;
}
