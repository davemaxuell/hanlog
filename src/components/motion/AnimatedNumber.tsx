'use client';
import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';
import { useMotionPreference } from './MotionPreference';
import { motionAllowed } from './kit';

/** Counts to a new value (motion.dev number animation). Shows the value directly when animations are reduced. */
export function AnimatedNumber({ value, from }: { value: number; from?: number }) {
  const reduced = useMotionPreference()?.reduced ?? true;
  const latest = useRef(from ?? value);
  const [shown, setShown] = useState(from ?? value);
  useEffect(() => {
    if (reduced || !motionAllowed()) { latest.current = value; return; }
    if (latest.current === value) return;
    const controls = animate(latest.current, value, {
      duration: 0.8, ease: [0.22, 1, 0.36, 1],
      onUpdate: current => { latest.current = current; setShown(Math.round(current)); },
    });
    return () => controls.stop();
  }, [value, reduced]);
  return <>{reduced ? value : shown}</>;
}

/** Three dots that hop in turn while something loads (motion.dev "Jumping dots"). */
export function JumpingDots({ label }: { label: string }) {
  return <span className="hl-jumping" role="status"><span className="hl-sr-only">{label}</span><span aria-hidden="true"><i /><i /><i /></span><span aria-hidden="true">{label}</span></span>;
}
