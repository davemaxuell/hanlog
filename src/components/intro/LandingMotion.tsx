'use client';
import { useEffect, useRef } from 'react';
import { animate, hover, scroll, stagger } from 'motion';
import { useMotionPreference } from '@/components/motion/MotionPreference';
import { finePointer, motionAllowed, riseOnView, settle, springs } from '@/components/motion/kit';
import styles from './intro.module.css';

const all = (selector: string) => Array.from(document.querySelectorAll(selector));

/**
 * Landing-page motion, layered onto the existing sections:
 * a scroll progress line, a word-by-word headline lift, hero parallax, a magnetic call to action,
 * and cards that rise as they arrive. Everything is transform-only and settles at rest when animations are reduced.
 */
export function LandingMotion() {
  const bar = useRef<HTMLDivElement>(null);
  const reduced = useMotionPreference()?.reduced ?? true;
  useEffect(() => {
    if (reduced || !motionAllowed()) return;
    const cleanups: VoidFunction[] = [];

    // Scroll progress (motion.dev "Scroll progress"): a thin line that fills as the story is read.
    const line = bar.current;
    if (line) {
      const stop = scroll(animate(line, { scaleX: [0, 1] }, { ease: 'linear' }));
      cleanups.push(() => { stop(); settle([line], { scaleX: 0 }); });
    }

    // Headline (motion.dev "Reveal text effect"): each word rises out of its own mask.
    const hero = document.querySelector('[data-section="hero"]');
    const words = all('[data-hero-word] > span');
    const support = hero ? Array.from(hero.querySelectorAll(':scope > div:first-child > :not(h1)')) : [];
    const entrances = [
      ...(words.length ? [animate(words, { y: ['105%', '0%'] }, { ...springs.soft, delay: stagger(0.08, { startDelay: 0.1 }) })] : []),
      ...(support.length ? [animate(support, { y: [18, 0] }, { ...springs.soft, delay: stagger(0.08, { startDelay: 0.35 }) })] : []),
    ];
    cleanups.push(() => entrances.forEach(entrance => entrance.complete()));

    // Parallax (motion.dev "Parallax"): the window art drifts slower than the page.
    const art = hero?.querySelector(':scope > div:last-child');
    if (hero && art) {
      const stop = scroll(animate(art, { y: [0, -70] }, { ease: 'linear' }), { target: hero, offset: ['start start', 'end start'] });
      cleanups.push(() => { stop(); settle([art]); });
    }

    // Magnetic call to action (motion.dev "Spring: Follow cursor"), only for a mouse.
    if (finePointer()) {
      const buttons = all('[data-section="hero"] a.hl-link-button, [data-section="how"] a.hl-link-button');
      for (const button of buttons) {
        cleanups.push(hover(button, (element, start) => {
          const rect = element.getBoundingClientRect();
          const follow = (event: PointerEvent) => {
            animate(element, { x: (event.clientX - rect.left - rect.width / 2) * 0.18, y: (event.clientY - rect.top - rect.height / 2) * 0.28 }, springs.snappy);
          };
          follow(start);
          element.addEventListener('pointermove', follow as EventListener);
          return () => { element.removeEventListener('pointermove', follow as EventListener); animate(element, { x: 0, y: 0 }, springs.bouncy); };
        }));
      }
      cleanups.push(() => settle(buttons));
    }

    // How it works: the phone glides against the scroll; step tiles rise in turn.
    const how = document.querySelector('[data-section="how"]');
    const phone = how?.querySelector('[data-phone-screen]');
    if (how && phone) {
      const stop = scroll(animate(phone, { y: [50, -30] }, { ease: 'linear' }), { target: how, offset: ['start end', 'end start'] });
      cleanups.push(() => { stop(); settle([phone]); });
    }
    cleanups.push(riseOnView(all('[data-section="how"] li')));

    // Why: the star pops as the promise arrives. Rewards and questions (motion.dev "Stagger") cascade into place.
    cleanups.push(riseOnView(all('[data-section="why"] > span[aria-hidden="true"]'), { y: 0, scale: 0.5 }));
    cleanups.push(riseOnView(all('[data-section="rewards"] article'), { y: 36 }));
    cleanups.push(riseOnView(all('[data-section="questions"] details'), { y: 18, scale: 1, gap: 0.05 }));
    return () => cleanups.forEach(cleanup => cleanup());
  }, [reduced]);
  return <div ref={bar} className={styles.progress} aria-hidden="true" />;
}
