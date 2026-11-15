'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Microphone, ChatsCircle, Notebook } from '@phosphor-icons/react';
import { api, ApiClientError } from '@/lib/api-client';
import { accountApi } from '@/lib/account-client';
import { RecoveryKeySchema, type RecoveryResult } from '@/lib/account-contracts';
import { countChars, isValidNickname, type Role } from '@/lib/contracts';
import { Button, Field, Ko, StatusNote } from '@/components/ui';
import { RecoveryKeyNotice } from '@/components/account/RecoveryKeyNotice';
import { CONSENT_TEXT, safeNext, useOptionalSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import styles from '@/components/account/account.module.css';

export default function Onboarding() {
  const router = useRouter(); const search = useSearchParams(); const { user, setUser } = useOptionalSession(); const next = safeNext(search.get('next'));
  const [mode, setMode] = useState<'new' | 'restore'>(search.get('mode') === 'restore' ? 'restore' : 'new');
  const [nickname, setNickname] = useState(''); const [role, setRole] = useState<Role>('learner'); const [consent, setConsent] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState(''); const [restored, setRestored] = useState<RecoveryResult | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false); const retryId = useRef<string | null>(null);
  useEffect(() => { if (user && mode === 'new' && !restored) router.replace(next); }, [user, router, next, mode, restored]);
  const start = async () => {
    if (lock.current || !consent || !isValidNickname(nickname)) return;
    lock.current = true; setBusy(true); setError('');
    try { setUser(await api.createSession({ nickname: nickname.trim(), role })); router.replace(next); }
    catch (cause) { setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
    finally { lock.current = false; setBusy(false); }
  };
  const restore = async () => {
    if (lock.current || !RecoveryKeySchema.safeParse(recoveryKey).success) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (!retryId.current) {
        try { retryId.current = sessionStorage.getItem('hl_restore_request'); } catch { /* Storage may be disabled. */ }
        retryId.current ||= crypto.randomUUID();
        try { sessionStorage.setItem('hl_restore_request', retryId.current); } catch { /* The in-memory proof still supports retries. */ }
      }
      const result = await accountApi.restore(recoveryKey.trim(), retryId.current);
      setRestored(result); setRecoveryKey('');
      try { sessionStorage.removeItem('hl_restore_request'); } catch { /* No credential was persisted. */ }
    } catch (cause) { setError(cause instanceof ApiClientError && ['invalid_input', 'unauthenticated', 'daily_limit'].includes(cause.code) ? cause.message : 'We could not finish restoring your profile. Keep this page open and try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  function finishRestore() { if (restored) { setUser(restored.user); setRestored(null); router.replace(next); } }
  return <div className={styles.onboarding}>
    <aside className={styles.welcome}><span className={styles.welcomeStar} aria-hidden="true">✦</span><h1>{mode === 'restore' ? 'Your words are waiting.' : 'Make room for your Korean.'}</h1><p>{mode === 'restore' ? 'Bring your expressions, feedback, and small wins with you.' : 'Start small. Speak a little. Find your people along the way.'}</p><ul className={styles.welcomeList}><li><Microphone size={23} aria-hidden="true" />Short speaking missions</li><li><ChatsCircle size={23} aria-hidden="true" />Feedback from Korean-speaking peers</li><li><Notebook size={23} aria-hidden="true" />Your own growing phrasebook</li></ul></aside>
    <div className={styles.formPanel}>{restored ? <RecoveryKeyNotice recoveryKey={restored.recoveryKey} onDone={finishRestore} doneLabel="Continue to my profile" /> : <>
      <div className={styles.switcher} aria-label="Profile access"><button type="button" aria-pressed={mode === 'new'} disabled={busy} onClick={() => { setMode('new'); setError(''); }}>Start fresh</button><button type="button" aria-pressed={mode === 'restore'} disabled={busy} onClick={() => { setMode('restore'); setError(''); }}>I have a recovery key</button></div>
      {mode === 'new' ? <form className="hl-stack" onSubmit={event => { event.preventDefault(); void start(); }}>
        <Field label="Nickname" value={nickname} onChange={event => setNickname(event.target.value)} hint="2 to 20 characters. Letters, numbers, spaces, dots, underscores, or hyphens." counter={{ value: countChars(nickname), max: 20 }} autoComplete="nickname" disabled={busy} />
        <fieldset className="hl-role-options" disabled={busy}><legend>What brings you here?</legend><label><input type="radio" name="role" checked={role === 'learner'} onChange={() => setRole('learner')} /><span>I&apos;m learning Korean</span></label><label><input type="radio" name="role" checked={role === 'korean'} onChange={() => setRole('korean')} /><span>I speak Korean · <Ko>한국어 화자예요</Ko></span></label></fieldset>
        <div><label className="hl-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>{CONSENT_TEXT}</span></label><Link href="/privacy">Read the privacy notice</Link></div>
        {error && <StatusNote tone="error">{error}</StatusNote>}<Button type="submit" disabled={!consent || !isValidNickname(nickname)} busy={busy} busyLabel="Starting…">Start</Button>
        <p className="hl-caption">No email or password needed. Save a recovery key in Me to keep your progress across devices.</p>
      </form> : <form className="hl-stack" onSubmit={event => { event.preventDefault(); void restore(); }}>
        <div className="hl-stack-sm"><h2>Welcome back.</h2><p>Paste the private key you saved from Me. Restoring replaces that key and signs out your other devices.</p>{user && <p className="hl-caption">This switches your browser to the restored profile. Profiles are not merged.</p>}</div>
        <div className="hl-field"><label htmlFor="recovery-key">Recovery key</label><textarea id="recovery-key" className={styles.restoreInput} value={recoveryKey} onChange={event => setRecoveryKey(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} placeholder="hlk_…" aria-describedby="restore-help" /><p id="restore-help" className="hl-caption">Keep it private. HanLog never asks you to post or send your key to another person.</p></div>
        {error && <StatusNote tone="error">{error}</StatusNote>}<Button type="submit" busy={busy} busyLabel="Restoring…" disabled={!RecoveryKeySchema.safeParse(recoveryKey).success}>Restore my profile</Button>
        <p className="hl-caption">Lost your key? We cannot recover a profile by nickname. If you still have it open on another device, create a replacement key there.</p><Link href="/help#recovery">Help with recovery</Link>
      </form>}
    </>}</div>
  </div>;
}
