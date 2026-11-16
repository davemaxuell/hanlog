'use client';
import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useMotionPreference } from './MotionPreference';

/** Binds Motion's React components to HanLog's own "Reduce animations" switch and the device setting. */
export function MotionLibraryConfig({ children }: { children: ReactNode }) {
  const reduced = useMotionPreference()?.reduced ?? true;
  return <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>{children}</MotionConfig>;
}
