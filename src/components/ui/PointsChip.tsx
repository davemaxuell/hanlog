'use client';
import { useEffect, useRef, useState } from 'react';
import { useMotionPreference } from '@/components/motion/MotionPreference';

export function PointsChip({ balance, unavailable = false }: { balance: number | null; unavailable?: boolean }) {
  const prevBalance = useRef<number | null>(balance);
  const [bumping, setBumping] = useState(false);
  const reduced = useMotionPreference()?.reduced ?? false;

  useEffect(() => {
    const previous = prevBalance.current;
    prevBalance.current = balance;
    if (reduced || balance === null || previous === null || balance <= previous) return;
    const frame = window.requestAnimationFrame(() => setBumping(true));
    const timer = window.setTimeout(() => setBumping(false), 480);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [balance, reduced]);

  return (
    <span
      className={bumping ? 'hl-points hl-points--bump' : 'hl-points'}
      aria-live="polite"
      aria-label={unavailable ? 'Points unavailable' : balance === null ? 'Points loading' : `${balance} points`}
      data-testid="points-balance"
    >
      {unavailable ? '★ —' : balance === null ? '★ …' : `★ ${balance} points`}
    </span>
  );
}
