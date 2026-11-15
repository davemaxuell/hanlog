'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import { countChars, isValidNickname, type Role } from '@/lib/contracts';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Field, Ko, StatusNote, Surface } from '@/components/ui';
import styles from './profile.module.css';

export default function Me() {
  const { user, setUser } = useSession();
  const router = useRouter();
  const [nickname, setNickname] = useState(user.nickname);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  async function update(patch: Parameters<typeof api.updateSession>[0]) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setSaved(false); setError('');
    try { setUser(await api.updateSession(patch)); setSaved(true); }
    catch (cause) { setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setDeleteError('');
    try { await api.deleteSession(); dialog.current?.close(); router.replace('/'); }
    catch (cause) { setDeleteError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
    finally { lock.current = false; setBusy(false); }
  }
  const roleChoice = (role: Role) => { if (role !== user.role) void update({ role }); };
  return <div className="hl-stack">
    <header className="hl-page-heading"><p className="hl-eyebrow">Your little corner</p><h1>Me</h1><p>A name to remember. A role to grow into.</p></header>
    <Surface><form className="hl-stack" onSubmit={event => { event.preventDefault(); if (isValidNickname(nickname)) void update({ nickname: nickname.trim() }); }}>
      <Field label="Nickname" value={nickname} onChange={event => { setNickname(event.target.value); setSaved(false); }} autoComplete="nickname" hint="2 to 20 characters." counter={{ value: countChars(nickname), max: 20 }} disabled={busy} />
      <div className="hl-actions"><Button type="submit" disabled={!isValidNickname(nickname)} busy={busy} busyLabel="Saving…">Save</Button></div>
    </form></Surface>
    <fieldset className="hl-role-options" disabled={busy}><legend>Your role</legend>
      <label><input type="radio" name="role" checked={user.role === 'learner'} onChange={() => roleChoice('learner')} /><span>I&apos;m learning Korean</span></label>
      <label><input type="radio" name="role" checked={user.role === 'korean'} onChange={() => roleChoice('korean')} /><span>I speak Korean · <Ko>한국어 화자예요</Ko></span></label>
    </fieldset>
    {error && <StatusNote tone="error">{error}</StatusNote>}
    {saved && <StatusNote tone="success">Saved.</StatusNote>}
    <p className="hl-caption">Your profile is connected to this browser. Clearing its cookies means starting again.</p>
    <Link href="/privacy">Privacy notice</Link>
    <div className="hl-actions"><Button variant="secondary" disabled={busy} onClick={() => { setDeleteError(''); dialog.current?.showModal(); }}>Delete my data</Button></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="delete-heading" onCancel={event => { if (busy) event.preventDefault(); }}>
      <div className="hl-stack"><h2 id="delete-heading">Delete your data?</h2><p>This removes your nickname, scores, points, challenges, answers, and stored recordings. It cannot be undone.</p>
        {deleteError && <StatusNote tone="error">{deleteError}</StatusNote>}
        <div className="hl-actions"><Button variant="secondary" disabled={busy} onClick={() => dialog.current?.close()}>Keep my data</Button><Button busy={busy} busyLabel="Deleting…" onClick={() => void remove()}>Yes, delete everything</Button></div>
      </div>
    </dialog>
  </div>;
}
