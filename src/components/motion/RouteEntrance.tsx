'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useMotionPreference } from './MotionPreference';

export function RouteEntrance({ children }: { children: ReactNode }) {
  const pathname = usePathname(); const region = useRef<HTMLDivElement>(null);
  const keyboard = useRef(false);
  const reduced = useMotionPreference()?.reduced ?? true;
  useEffect(() => {
    const key = () => { keyboard.current = true; }; const pointer = () => { keyboard.current = false; };
    window.addEventListener('keydown', key); window.addEventListener('pointerdown', pointer);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', pointer); };
  }, []);
  useEffect(() => {
    const element = region.current;
    if (reduced || keyboard.current || !element?.animate || document.activeElement?.matches(':focus-visible')) return;
    const animation = element.animate([{ transform: 'translateY(7px)' }, { transform: 'translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
    return () => animation.cancel();
  }, [pathname, reduced]);
  // This wrapper is intentionally never keyed by the route or motion preference.
  return <div ref={region} className="hl-route-content">{children}</div>;
}
