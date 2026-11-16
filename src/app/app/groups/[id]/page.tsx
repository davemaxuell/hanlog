'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Copy, ShareNetwork } from '@phosphor-icons/react';
import { ApiClientError } from '@/lib/api-client';
import { socialApi } from '@/lib/social-client';
import type { LeaderboardPeriod } from '@/lib/social-contracts';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';
import { CommunityTabs, PeriodSwitch, RankList } from '@/components/social/SocialParts';
import styles from '@/components/social/social.module.css';
import { motion } from 'motion/react';
import { springs } from '@/components/motion/kit';
import { JumpingDots } from '@/components/motion/AnimatedNumber';

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const detail = useApi(() => socialApi.group(id, period), [id, period]);
  const [copied, setCopied] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const group = detail.data?.group;

  const invite = async () => {
    if (!group) return;
    const url = `${window.location.origin}/app/groups?join=${group.code}`;
    const text = `Join my HanLog group “${group.name}” with code ${group.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: group.name, text, url }); return; }
      await navigator.clipboard.writeText(`${text}: ${url}`);
      setCopied('Invite link copied.');
    } catch { setCopied(`Share this code: ${group.code}`); }
  };
  const leave = async () => {
    setLeaving(true); setError('');
    try { await socialApi.leaveGroup(id); router.push('/app/groups'); }
    catch (cause) { setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal') || errorCopy('internal')); setLeaving(false); }
  };

  if (detail.error) return <div className="hl-stack">
    <CommunityTabs />
    <StatusNote tone="error">{detail.error.code === 'not_found' ? 'This group is closed or you are not a member.' : errorCopy(detail.error.code) || errorCopy('internal')}</StatusNote>
    <Link className="hl-back-link" href="/app/groups"><ArrowLeft size={18} aria-hidden="true" /> Groups</Link>
  </div>;
  return <div className="hl-stack">
    <CommunityTabs />
    <Link className="hl-back-link" href="/app/groups"><ArrowLeft size={18} aria-hidden="true" /> Groups</Link>
    {!group && <JumpingDots label="Loading the group…" />}
    {group && <>
      <header className={styles.introRow}>
        <div className={styles.intro}>
          <h1>{group.name}</h1>
          <p>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}. Compare points, expressions practised and average scores.</p>
        </div>
        <div className={styles.code}><span>Join code</span><b className={styles.codeChars}>{[...group.code].map((char, index) => <motion.span key={index} initial={{ y: -18, rotateX: 90 }} animate={{ y: 0, rotateX: 0 }} transition={{ ...springs.bouncy, delay: 0.1 + index * 0.06 }}>{char}</motion.span>)}</b>
          <Button variant="secondary" onClick={() => void invite()}>{typeof navigator !== 'undefined' && 'share' in navigator ? <ShareNetwork size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}Invite</Button>
        </div>
      </header>
      {copied && <StatusNote tone="success">{copied}</StatusNote>}
      <PeriodSwitch period={period} onChange={setPeriod} />
      {detail.data && <RankList people={detail.data.members} label={`${group.name} members`} empty="No members yet." />}
      {detail.data && detail.data.members.length === 1 && <p className={styles.empty}>It is just you so far. Tap Invite and send the code to your friends.</p>}
      <div className={styles.groupActions}>
        {confirmLeave
          ? <><Button variant="secondary" busy={leaving} busyLabel={group.isOwner ? 'Closing…' : 'Leaving…'} onClick={() => void leave()}>{group.isOwner ? 'Close group for everyone' : 'Leave group'}</Button><Button variant="text" onClick={() => setConfirmLeave(false)}>Stay</Button></>
          : <Button variant="text" onClick={() => setConfirmLeave(true)}>{group.isOwner ? 'Close this group' : 'Leave this group'}</Button>}
      </div>
      {error && <StatusNote tone="error">{error}</StatusNote>}
    </>}
  </div>;
}
