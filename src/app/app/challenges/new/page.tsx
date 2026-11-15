'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api-client';
import { countChars, containsHangul, CreateChallengeFieldsSchema, LIMITS, type Challenge } from '@/lib/contracts';
import { useSession, useSessionExpired } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Field, StatusNote, TextArea } from '@/components/ui';
import { Recorder } from '@/components/recorder/Recorder';
import { SharePanel } from '@/components/challenge/SharePanel';
import styles from '@/components/challenge/community.module.css';
export default function NewChallenge() {
  const { user } = useSession(); const sessionExpired = useSessionExpired();
  const [korean, setKorean] = useState(''); const [meaningEn, setMeaning] = useState(''); const [situationEn, setSituation] = useState('');
  const [media, setMedia] = useState<{ blob: Blob; durationMs: number } | null>(null); const [result, setResult] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const fields = CreateChallengeFieldsSchema.safeParse({ korean, meaningEn, situationEn });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!fields.success || lock.current) return; lock.current = true; setBusy(true); setError(null);
    try { setResult(await api.createChallenge({ ...fields.data, ...(media ? { media } : {}) })); }
    catch (cause) { if (cause instanceof ApiClientError && cause.code === 'unauthenticated') sessionExpired(); else setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
    finally { lock.current = false; setBusy(false); }
  };
  if (user.role !== 'korean') return <div className="hl-stack"><h1>Share your Korean.</h1><p>Only Korean speakers can post challenges. You can switch your role on the Me screen.</p><Link className="hl-back-link" href="/app/me">Go to Me</Link></div>;
  return <div className="hl-stack"><Link className="hl-back-link" href="/app/challenges">← Challenges</Link><header className={styles.newIntro}><p className="hl-eyebrow">From your everyday Korean</p><h1>Give someone a new way to say it.</h1><p>An expression, a little context, and a chance to practice. Choose something useful, explain when to use it, then invite a learner to try.</p></header>{result ? <><SharePanel code={result.code} /><Link className="hl-back-link" href={`/app/challenges/${result.id}`}>Open your challenge</Link></> : <form onSubmit={submit} className={styles.newForm}>
    <Field label="Korean expression" lang="ko" value={korean} onChange={event => setKorean(event.target.value)} counter={{ value: countChars(korean), max: LIMITS.challengeKorean.max }} error={korean && !containsHangul(korean) ? 'Write the expression in Hangul.' : countChars(korean) > LIMITS.challengeKorean.max ? 'Keep it to 60 characters.' : undefined} />
    <Field label="Meaning in English" value={meaningEn} onChange={event => setMeaning(event.target.value)} counter={{ value: countChars(meaningEn), max: LIMITS.meaningEn.max }} error={countChars(meaningEn) > LIMITS.meaningEn.max ? 'Keep it to 120 characters.' : undefined} />
    <TextArea label="Situation or example (optional)" value={situationEn} onChange={event => setSituation(event.target.value)} counter={{ value: countChars(situationEn), max: LIMITS.situationEn.max }} error={countChars(situationEn) > LIMITS.situationEn.max ? 'Keep it to 200 characters.' : undefined} />
    <section aria-labelledby="reference-title" className="hl-stack-sm"><h2 id="reference-title">Add your voice <span className="hl-caption">(optional)</span></h2><p className="hl-caption">Give learners a reference they can listen to. Shared recordings stay for up to 14 days.</p><Recorder modes={['audio']} submitLabel="Use this recording" busy={busy} onReset={() => setMedia(null)} onSubmit={recording => setMedia({ blob: recording.blob, durationMs: recording.durationMs })} />{media && <StatusNote tone="success">Reference recording added.</StatusNote>}</section>
    {error && <StatusNote tone="error">{error}</StatusNote>}<Button type="submit" disabled={!fields.success} busy={busy} busyLabel="Posting…" className="hl-fit">Post challenge</Button>
  </form>}</div>;
}
