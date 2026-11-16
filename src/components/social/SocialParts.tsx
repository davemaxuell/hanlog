'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LeaderboardPeriod, RankedPerson } from '@/lib/social-contracts';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { springs } from '@/components/motion/kit';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import styles from './social.module.css';

const communityTabs = [
  { label: 'Feed', href: '/app/feed' },
  { label: 'Challenges', href: '/app/challenges' },
  { label: 'Groups', href: '/app/groups' },
  { label: 'Ranks', href: '/app/leaderboard' },
];
export const COMMUNITY_PATHS = communityTabs.map(tab => tab.href);

/** The four places inside Community. The dark pill slides to the chosen place (motion.dev "Tab select"). */
export function CommunityTabs() {
  const pathname = usePathname();
  return <nav className={styles.tabs} aria-label="Community">
    {communityTabs.map(tab => {
      const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
      return <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}>
        {active && <motion.span layoutId="community-tab" className={styles.tabPill} transition={springs.snappy} aria-hidden="true" />}
        <span>{tab.label}</span>
      </Link>;
    })}
  </nav>;
}

export function PeriodSwitch({ period, onChange }: { period: LeaderboardPeriod; onChange(period: LeaderboardPeriod): void }) {
  const id = useId();
  return <div className={styles.period} role="group" aria-label="Points period">
    {([['today', 'Today'], ['all', 'All time']] as const).map(([value, label]) =>
      <button key={value} type="button" aria-pressed={period === value} onClick={() => onChange(value)}>
        {period === value && <motion.span layoutId={`${id}-period`} className={styles.periodPill} transition={springs.snappy} aria-hidden="true" />}
        <span>{label}</span>
      </button>)}
  </div>;
}

export const roleLabel = (role: RankedPerson['role']) => role === 'korean' ? 'Korean speaker' : 'Learning Korean';
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return <span className={styles.avatar} data-size={size} aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase() ?? '?'}</span>;
}

/**
 * A ranked list. Rows glide to their new places when ranks change (motion.dev "Reorder items"),
 * points count up, and bars grow to compare each person with the leader.
 */
export function RankList({ people, label, empty }: { people: RankedPerson[]; label: string; empty: string }) {
  const still = useMotionPreference()?.reduced ?? true;
  if (!people.length) return <p className={styles.empty}>{empty}</p>;
  const top = Math.max(1, ...people.map(person => person.points));
  return <ol className={styles.ranks} aria-label={label}>
    <AnimatePresence initial={false}>
      {people.map((person, index) => <motion.li layout key={person.userId} className={styles.rankRow} data-me={person.isMe || undefined} data-place={person.rank <= 3 ? person.rank : undefined}
        initial={{ y: 16, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ ...springs.soft, delay: Math.min(index, 8) * 0.03 }}>
        <span className={styles.place}><span className="hl-sr-only">Rank </span>{person.rank}</span>
        <Avatar name={person.nickname} />
        <span className={styles.who}>
          <span className={styles.name}>{person.nickname}{person.isMe && <span className={styles.youTag}>You</span>}</span>
          <span className={styles.meta}>{roleLabel(person.role)} · {person.practised} {person.practised === 1 ? 'expression' : 'expressions'}{person.averageScore !== null ? ` · average ${person.averageScore}` : ''}</span>
          <span className={styles.bar} aria-hidden="true"><motion.i initial={still ? false : { width: 0 }} animate={{ width: `${Math.round((person.points / top) * 100)}%` }} transition={{ ...springs.soft, delay: 0.15 + Math.min(index, 8) * 0.05 }} /></span>
        </span>
        <span className={styles.points}><b><AnimatedNumber value={person.points} from={0} /></b> pts</span>
      </motion.li>)}
    </AnimatePresence>
  </ol>;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
