'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { socialApi } from '@/lib/social-client';
import type { Leaderboard, LeaderboardPeriod } from '@/lib/social-contracts';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';
import { CommunityTabs, PeriodSwitch, RankList } from '@/components/social/SocialParts';
import styles from '@/components/social/social.module.css';
import { JumpingDots } from '@/components/motion/AnimatedNumber';

const REFRESH_MS = 20_000;
function standing(board: Leaderboard): { headline: string; detail: string } {
  const when = board.period === 'today' ? 'today' : 'overall';
  if (!board.me.visible) return { headline: `${board.me.points} points ${when}`, detail: 'You are hidden from leaderboards. You can change this in Me.' };
  if (board.me.rank === null) return { headline: 'Not on the board yet', detail: 'Finish a mission, answer a challenge or share a moment to earn your first points.' };
  return { headline: `You're #${board.me.rank} ${when}`, detail: `${board.me.points} points. Every mission, peer exchange and shared moment counts.` };
}

export default function Ranks() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');
  const board = useApi(() => socialApi.leaderboard(period), [period]);
  const { reload } = board;
  // A live board for demos and classrooms: refresh while the page is visible.
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') reload(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);
  const mine = board.data ? standing(board.data) : null;
  return <div className="hl-stack">
    <CommunityTabs />
    <header className={styles.intro}>
      <h1>Who&apos;s speaking up?</h1>
      <p>Points from missions, peer exchanges and shared moments. Today starts at midnight Korea time.</p>
    </header>
    <PeriodSwitch period={period} onChange={setPeriod} />
    {mine && <div className={styles.standing}><div className="hl-stack-sm"><strong>{mine.headline}</strong><p>{mine.detail}</p></div><Link className="hl-link-button" href="/app/missions">Earn points</Link></div>}
    {board.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(board.error.code) || errorCopy('internal')}</StatusNote><Button variant="secondary" className="hl-fit" onClick={reload}>Try again</Button></div>}
    {!board.data && board.loading && <JumpingDots label="Loading the leaderboard…" />}
    {board.data && <RankList people={board.data.entries} label={period === 'today' ? "Today's leaderboard" : 'All-time leaderboard'}
      empty={period === 'today' ? 'Nobody has earned points yet today. A single mission puts you at the top.' : 'Nobody has earned points yet.'} />}
    <p className={styles.updated}>Updates every 20 seconds. Nicknames and points are visible to everyone signed in. <Link href="/app/me#leaderboards">Leaderboard settings</Link></p>
  </div>;
}
