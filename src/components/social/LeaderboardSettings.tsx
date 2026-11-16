'use client';
import { useState } from 'react';
import { Trophy } from '@phosphor-icons/react';
import { socialApi } from '@/lib/social-client';
import { useApi } from '@/lib/ui/use-api';
import { errorCopy } from '@/lib/ui/error-copy';
import { StatusNote } from '@/components/ui';

/** Lets a person leave public leaderboards. Group members still compare with each other. */
export function LeaderboardSettings({ className, headerClassName }: { className: string; headerClassName: string }) {
  const board = useApi(() => socialApi.leaderboard('all'), []);
  const [visible, setVisible] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const shown = visible ?? board.data?.me.visible ?? true;
  const change = async (next: boolean) => {
    setVisible(next); setError('');
    try { await socialApi.setLeaderboardVisibility(next); }
    catch { setVisible(!next); setError(errorCopy('internal')); }
  };
  return <section id="leaderboards" className={className} aria-labelledby="leaderboards-heading">
    <div className={headerClassName}><Trophy size={28} aria-hidden="true" /><h2 id="leaderboards-heading">Leaderboards</h2></div>
    <p>Your nickname and points appear on the public leaderboard. Groups you join always compare members, including you.</p>
    <label className="hl-consent"><input type="checkbox" checked={shown} disabled={!board.data} onChange={event => void change(event.target.checked)} /><span>Show me on public leaderboards</span></label>
    {error && <StatusNote tone="error">{error}</StatusNote>}
  </section>;
}
