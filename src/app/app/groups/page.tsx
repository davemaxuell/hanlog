'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { LIMITS, SHARE_CODE_ALPHABET, countChars } from '@/lib/contracts';
import { socialApi } from '@/lib/social-client';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, Field, StatusNote } from '@/components/ui';
import { CommunityTabs } from '@/components/social/SocialParts';
import styles from '@/components/social/social.module.css';
import { motion } from 'motion/react';
import { springs } from '@/components/motion/kit';

function groupError(cause: unknown, joining: boolean): string {
  const code = cause instanceof ApiClientError ? cause.code : 'internal';
  if (code === 'not_found') return 'No group uses that code. Check it with the person who invited you.';
  if (code === 'conflict') return joining ? 'That group is full, or you are already in ten groups.' : 'You are already in ten groups. Leave one to start another.';
  if (code === 'daily_limit') return joining ? 'Too many codes that did not match. Wait an hour, then check the code and try again.' : 'You have started five groups today. Try again tomorrow.';
  return errorCopy(code) || errorCopy('internal');
}
const validCode = (value: string) => value.length === 6 && [...value].every(letter => SHARE_CODE_ALPHABET.includes(letter));

export default function Groups() {
  const router = useRouter();
  const invited = (useSearchParams().get('join') ?? '').toUpperCase();
  const groups = useApi(() => socialApi.groups(), []);
  const [name, setName] = useState(''); const [code, setCode] = useState(invited);
  const [createError, setCreateError] = useState(''); const [joinError, setJoinError] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (countChars(name.trim()) < LIMITS.groupName.min) { setCreateError('Give your group a name of at least two characters.'); return; }
    setBusy('create'); setCreateError('');
    try { const { group } = await socialApi.createGroup(name.trim()); router.push(`/app/groups/${group.id}`); }
    catch (cause) { setCreateError(groupError(cause, false)); setBusy(null); }
  };
  const join = async (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim().toUpperCase();
    if (!validCode(value)) { setJoinError('Enter the six-character group code.'); return; }
    setBusy('join'); setJoinError('');
    try { const { group } = await socialApi.joinGroup(value); router.push(`/app/groups/${group.id}`); }
    catch (cause) { setJoinError(groupError(cause, true)); setBusy(null); }
  };
  return <div className="hl-stack">
    <CommunityTabs />
    <header className={styles.intro}>
      <h1>Practise together.</h1>
      <p>Start a group for your class, club or friends. Members compare points, expressions practised and average scores.</p>
    </header>
    {invited && <StatusNote tone="info">You were invited to a group. Check the code and join below.</StatusNote>}
    <div className={styles.groupTools}>
      <form className={styles.toolCard} onSubmit={event => void join(event)} noValidate>
        <h2>Join with a code</h2>
        <Field label="Group code" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="ABC234" error={joinError} />
        <Button type="submit" className="hl-fit" busy={busy === 'join'} busyLabel="Joining…">Join group</Button>
      </form>
      <form className={styles.toolCard} onSubmit={event => void create(event)} noValidate>
        <h2>Start a group</h2>
        <Field label="Group name" value={name} maxLength={LIMITS.groupName.max} onChange={event => setName(event.target.value)} placeholder="Wednesday Korean club" error={createError} counter={{ value: countChars(name), max: LIMITS.groupName.max }} />
        <Button type="submit" variant="secondary" className="hl-fit" busy={busy === 'create'} busyLabel="Starting…">Start group</Button>
      </form>
    </div>
    <section className="hl-stack-sm" aria-labelledby="my-groups">
      <h2 id="my-groups">Your groups</h2>
      {groups.error && <StatusNote tone="error">{errorCopy(groups.error.code) || errorCopy('internal')}</StatusNote>}
      {groups.data && !groups.data.groups.length && <p className={styles.empty}>You are not in a group yet. Start one and share its code with your friends.</p>}
      {groups.data && groups.data.groups.length > 0 && <ul className={styles.groupList}>
        {groups.data.groups.map((group, index) => <motion.li key={group.id} initial={{ y: 20, scale: 0.97 }} animate={{ y: 0, scale: 1 }} whileHover={{ y: -4, rotate: -0.6 }} whileTap={{ scale: 0.97 }} transition={{ ...springs.soft, delay: Math.min(index, 6) * 0.06 }}><Link className={styles.groupCard} href={`/app/groups/${group.id}`}>
          <strong>{group.name}</strong><span>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}{group.isOwner ? ' · You started it' : ''}</span>
        </Link></motion.li>)}
      </ul>}
    </section>
  </div>;
}
