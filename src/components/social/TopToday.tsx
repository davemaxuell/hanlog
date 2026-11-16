'use client';
import Link from 'next/link';
import { socialApi } from '@/lib/social-client';
import { useApi } from '@/lib/ui/use-api';
import { RankList } from './SocialParts';
import styles from './social.module.css';

/** Today's top three on the home screen, so a demo room can see the race at a glance. */
export function TopToday() {
  const board = useApi(() => socialApi.leaderboard('today'), []);
  if (!board.data) return null;
  const { entries, me } = board.data;
  const meLine = !me.visible ? 'You are hidden from leaderboards.' : me.rank ? `You're #${me.rank} today with ${me.points} points.` : 'Earn points today to join the board.';
  return <section className="hl-stack-sm" aria-labelledby="top-today">
    <div className={styles.introRow}><h2 id="top-today">Top today</h2><Link href="/app/leaderboard">See all ranks →</Link></div>
    <RankList people={entries.slice(0, 3)} label="Top three today" empty="Nobody has points yet today. One mission puts you first." />
    <p className={styles.updated}>{meLine}</p>
  </section>;
}
