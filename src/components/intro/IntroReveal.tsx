'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import styles from './intro.module.css';

/** A one-time enhancement: content is never hidden while waiting for JavaScript or scrolling. */
export function IntroReveal({ children, className = '', ...props }: ComponentPropsWithoutRef<'section'>) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useMotionPreference()?.reduced;
  useEffect(() => {
    const element = ref.current;
    const reduceMotion = () => reduced || document.documentElement.dataset.motion === 'reduce'
      || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Removing and restoring animation:none would otherwise replay a completed CSS reveal.
    if (element && reduced && element.dataset.reveal === 'shown') element.dataset.reveal = 'still';
    if (!element || element.dataset.reveal || typeof IntersectionObserver === 'undefined' || reduceMotion()) return;
    let disposed = false;
    const observer = new IntersectionObserver(entries => {
      if (disposed || !entries.some(entry => entry.isIntersecting)) return;
      disposed = true;
      element.dataset.reveal = reduceMotion() || element.contains(document.activeElement) ? 'still' : 'shown';
      observer.disconnect();
    }, { threshold: .12, rootMargin: '0px 0px -24px 0px' });
    observer.observe(element);
    return () => { disposed = true; observer.disconnect(); };
  }, [reduced]);
  return <section ref={ref} className={`${className} ${styles.reveal}`} {...props}>{children}</section>;
}
