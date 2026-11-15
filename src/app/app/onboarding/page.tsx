'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { countChars, isValidNickname, type Role } from '@/lib/contracts';
import { Button, CornerMark, Field, Ko, StatusNote } from '@/components/ui';
import { CONSENT_TEXT, safeNext, useOptionalSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
export default function Onboarding() {
  const router = useRouter(); const search = useSearchParams(); const { user, setUser } = useOptionalSession(); const next = safeNext(search.get('next'));
  const [nickname, setNickname] = useState(''); const [role, setRole] = useState<Role>('learner'); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => { if (user) router.replace(next); }, [user, router, next]);
  const start = async () => {
    if (lock.current || !consent || !isValidNickname(nickname)) return;
    lock.current = true; setBusy(true); setError('');
    try { setUser(await api.createSession({ nickname: nickname.trim(), role })); router.replace(next); }
    catch (cause) { setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="hl-stack"><CornerMark><h1 className="hl-heading">Make room for your Korean.</h1></CornerMark><p>A name, a voice, a little courage. That is all you need to begin.</p><form className="hl-stack" onSubmit={event => { event.preventDefault(); void start(); }}>
    <Field label="Nickname" value={nickname} onChange={event => setNickname(event.target.value)} hint="2 to 20 characters. Letters, numbers, spaces, dots, underscores, or hyphens." counter={{ value: countChars(nickname), max: 20 }} autoComplete="nickname" />
    <fieldset className="hl-role-options"><legend>What brings you here?</legend><label><input type="radio" name="role" checked={role === 'learner'} onChange={() => setRole('learner')} /><span>I&apos;m learning Korean</span></label><label><input type="radio" name="role" checked={role === 'korean'} onChange={() => setRole('korean')} /><span>I speak Korean · <Ko>한국어 화자예요</Ko></span></label></fieldset>
    <label className="hl-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{CONSENT_TEXT}</span></label><Link href="/privacy">Read the privacy notice</Link>
    {error && <StatusNote tone="error">{error}</StatusNote>}<Button type="submit" disabled={!consent || !isValidNickname(nickname)} busy={busy} busyLabel="Starting…">Start</Button>
  </form><p className="hl-caption">Your profile lives in this browser. Clearing its cookies means starting again.</p></div>;
}
