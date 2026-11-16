'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Key, DownloadSimple, UserCircle, SignOut, CheckCircle } from '@phosphor-icons/react';
import { api, ApiClientError } from '@/lib/api-client';
import { accountApi } from '@/lib/account-client';
import type { AccountStatus } from '@/lib/account-contracts';
import { countChars, isValidNickname, type Role } from '@/lib/contracts';
import { useSession, useSessionExpired } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Field, Ko, StatusNote } from '@/components/ui';
import { downloadBlob } from '@/components/account/RecoveryKeyNotice';
import { useRecoveryKey } from '@/components/account/RecoveryKeyProvider';
import styles from '@/components/account/account.module.css';
import { LeaderboardSettings } from '@/components/social/LeaderboardSettings';

export default function Me() {
  const { user, setUser, endSession } = useSession(); const sessionExpired = useSessionExpired();
  const [nickname, setNickname] = useState(user.nickname); const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false);
  const [error, setError] = useState(''); const [deleteError, setDeleteError] = useState('');
  const [account, setAccount] = useState<AccountStatus | null>(null); const [accountError, setAccountError] = useState(''); const [accountRevision, setAccountRevision] = useState(0);
  const { pending: recoveryKey, showRecoveryKey } = useRecoveryKey();
  const lock = useRef(false); const dialog = useRef<HTMLDialogElement>(null); const rotateDialog = useRef<HTMLDialogElement>(null); const logoutDialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    void accountApi.status().then(value => { if (current) { setAccount(value); setAccountError(''); } }).catch(cause => { if (current) { if (cause instanceof ApiClientError && cause.code === 'unauthenticated') sessionExpired(); else setAccountError('We could not check your recovery settings.'); } });
    return () => { current = false; };
  }, [user.id, accountRevision, sessionExpired]);
  function handle(cause: unknown) { if (!alive.current) return; if (cause instanceof ApiClientError && cause.code === 'unauthenticated') sessionExpired(); else setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
  async function update(patch: Parameters<typeof api.updateSession>[0]) {
    if (lock.current) return; lock.current = true; setBusy(true); setSaved(false); setError('');
    try { const updated = await api.updateSession(patch); if (alive.current) { setUser(updated); setSaved(true); } } catch (cause) { handle(cause); } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function generateKey() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const result = await accountApi.createRecoveryKey(); if (alive.current) { setAccount({ recoveryEnabled: true, recoveryUpdatedAt: new Date().toISOString() }); rotateDialog.current?.close(); } showRecoveryKey(result.recoveryKey); }
    catch (cause) { handle(cause); } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function exportData() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const data = await accountApi.exportData(); if (alive.current) downloadBlob(data, `hanlog-data-${new Date().toISOString().slice(0, 10)}.json`); } catch (cause) { handle(cause); } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function logout() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await accountApi.logout(); if (alive.current) { logoutDialog.current?.close(); endSession('/app/onboarding?mode=restore'); } }
    catch (cause) { handle(cause); } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function remove() {
    if (lock.current) return; lock.current = true; setBusy(true); setDeleteError('');
    try { await api.deleteSession(); if (alive.current) { dialog.current?.close(); endSession('/'); } }
    catch (cause) { if (alive.current) { if (cause instanceof ApiClientError && cause.code === 'unauthenticated') sessionExpired(); else setDeleteError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const roleChoice = (role: Role) => { if (role !== user.role) void update({ role }); };
  return <div className="hl-stack">
    <header className={styles.profileHeader}><div className={styles.avatar} aria-hidden="true">{Array.from(user.nickname)[0]}</div><div><p className="hl-eyebrow">Your little corner</p><h1>{user.nickname}</h1><p>{user.role === 'learner' ? 'Finding your voice in Korean.' : 'Helping someone find their words.'}</p></div></header>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    <div className={styles.profileGrid}>
      <section className={styles.section} aria-labelledby="profile-heading"><div className={styles.sectionHeader}><UserCircle size={28} aria-hidden="true" /><h2 id="profile-heading">Make it yours</h2></div><form className="hl-stack" onSubmit={event => { event.preventDefault(); if (isValidNickname(nickname)) void update({ nickname: nickname.trim() }); }}><Field label="Nickname" value={nickname} onChange={event => { setNickname(event.target.value); setSaved(false); }} autoComplete="nickname" hint="2 to 20 characters." counter={{ value: countChars(nickname), max: 20 }} disabled={busy} /><div><Button type="submit" disabled={!isValidNickname(nickname)} busy={busy} busyLabel="Saving…">Save</Button></div></form>{saved && <StatusNote tone="success">Saved.</StatusNote>}
        <fieldset className="hl-role-options" disabled={busy}><legend>Your role</legend><label><input type="radio" name="role" checked={user.role === 'learner'} onChange={() => roleChoice('learner')} /><span>I&apos;m learning Korean</span></label><label><input type="radio" name="role" checked={user.role === 'korean'} onChange={() => roleChoice('korean')} /><span>I speak Korean · <Ko>한국어 화자예요</Ko></span></label></fieldset><p className="hl-caption">Choose how you want to participate. Roles are self-selected, not a language qualification.</p>
      </section>
      <section id="recovery" className={styles.section} aria-labelledby="recovery-heading">
        <>
          <div className={styles.sectionHeader}><Key size={28} aria-hidden="true" /><h2 id="recovery-heading">Keep your progress</h2></div>
          <p>A private recovery key lets you bring this profile to another device. No email or password required.</p>
          {accountError ? <><StatusNote tone="error">{accountError}</StatusNote><Button variant="secondary" onClick={() => setAccountRevision(n => n + 1)}>Retry recovery settings</Button></> : account ? <>
            {account.recoveryEnabled ? <><p className={styles.savedMark}><CheckCircle size={21} weight="fill" aria-hidden="true" />Recovery is set up</p><p className="hl-caption">We cannot show your old key. If you lost it, replace it here while you are still signed in.</p><Button variant="secondary" disabled={busy} onClick={() => { setError(''); rotateDialog.current?.showModal(); }}>Replace recovery key</Button></> : <><StatusNote tone="info">This profile currently depends on this browser. Save a key before clearing cookies or signing out.</StatusNote><Button disabled={busy} onClick={() => void generateKey()}>Create recovery key</Button></>}
          </> : <p role="status">Checking recovery settings…</p>}
          <Link href="/help#recovery">How recovery works</Link>
        </>
      </section>
      <LeaderboardSettings className={styles.section} headerClassName={styles.sectionHeader} />
      <section className={styles.section} aria-labelledby="data-heading"><div className={styles.sectionHeader}><DownloadSimple size={28} aria-hidden="true" /><h2 id="data-heading">Your learning, to keep</h2></div><p>Download your profile, practice history, points, and written contributions as a JSON file. Recovery keys and recordings are not included.</p><div><Button variant="secondary" disabled={busy} onClick={() => void exportData()}>Download my data</Button></div><div className={styles.inlineLinks}><Link href="/app/progress">View my progress →</Link><Link href="/app/rewards">Points & milestones →</Link></div></section>
      <section className={styles.section} aria-labelledby="session-heading"><div className={styles.sectionHeader}><SignOut size={28} aria-hidden="true" /><h2 id="session-heading">Take a break</h2></div><p>Sign out on every device without deleting your progress. You will need your saved recovery key to come back.</p><div><Button variant="secondary" disabled={busy || !account?.recoveryEnabled || !!recoveryKey} onClick={() => { setError(''); logoutDialog.current?.showModal(); }}>Sign out everywhere</Button></div>{!account?.recoveryEnabled && <p className="hl-caption">Set up recovery first so you can find your way back.</p>}</section>
      <section className={`${styles.section} ${styles.danger} ${styles.full}`} aria-labelledby="delete-section-heading"><h2 id="delete-section-heading">Your data. Your choice.</h2><p>Leaving for good? You can delete your profile and its stored data. Clearing browser cookies alone does not delete it.</p><div className="hl-actions"><Button variant="secondary" disabled={busy} onClick={() => { setDeleteError(''); dialog.current?.showModal(); }}>Delete my data</Button><Link href="/privacy">Privacy notice</Link></div></section>
    </div>
    <dialog ref={dialog} className="hl-dialog" aria-labelledby="delete-heading" onCancel={event => { if (busy) event.preventDefault(); }}><div className="hl-stack"><h2 id="delete-heading">Delete your data?</h2><p>This removes your nickname, scores, points, challenges, answers, and stored recordings. It cannot be undone.</p>{deleteError && <StatusNote tone="error">{deleteError}</StatusNote>}<div className="hl-actions"><Button variant="secondary" disabled={busy} onClick={() => dialog.current?.close()}>Keep my data</Button><Button busy={busy} busyLabel="Deleting…" onClick={() => void remove()}>Yes, delete everything</Button></div></div></dialog>
    <dialog ref={rotateDialog} className="hl-dialog" aria-labelledby="rotate-heading" onCancel={event => { if (busy) event.preventDefault(); }}><div className="hl-stack"><h2 id="rotate-heading">Replace your recovery key?</h2><p>The old key will stop working. Save the new one before leaving this page. Your signed-in devices stay connected.</p>{error && <StatusNote tone="error">{error}</StatusNote>}<div className="hl-actions"><Button variant="secondary" disabled={busy} onClick={() => rotateDialog.current?.close()}>Keep current key</Button><Button busy={busy} busyLabel="Creating…" onClick={() => void generateKey()}>Replace my key</Button></div></div></dialog>
    <dialog ref={logoutDialog} className="hl-dialog" aria-labelledby="logout-heading" onCancel={event => { if (busy) event.preventDefault(); }}><div className="hl-stack"><h2 id="logout-heading">Have your recovery key?</h2><p>Your progress will stay safe. This signs out every device, and only your current recovery key can open the profile again.</p>{error && <StatusNote tone="error">{error}</StatusNote>}<div className="hl-actions"><Button variant="secondary" disabled={busy} onClick={() => logoutDialog.current?.close()}>Stay signed in</Button><Button busy={busy} busyLabel="Signing out…" onClick={() => void logout()}>Yes, sign out</Button></div></div></dialog>
  </div>;
}
