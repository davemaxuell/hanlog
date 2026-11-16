'use client';
import { animate, inView, stagger } from 'motion';

/** Motion runs only when neither the HanLog "Reduce animations" switch nor the device asks for stillness. */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || document.documentElement.dataset.motion === 'reduce') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
export const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

export const springs = {
  snappy: { type: 'spring', stiffness: 520, damping: 36 },
  soft: { type: 'spring', stiffness: 240, damping: 26 },
  bouncy: { type: 'spring', stiffness: 380, damping: 16 },
} as const;

/**
 * Rises a group of elements into place as they scroll into view, one after another.
 * Transform only: content stays readable and visible before, during and without the effect.
 */
export function riseOnView(targets: Element[], options: { y?: number; scale?: number; gap?: number; amount?: number } = {}): VoidFunction {
  if (!targets.length || !motionAllowed() || typeof IntersectionObserver === 'undefined') return () => {};
  const { y = 28, scale = 0.98, gap = 0.07, amount = 0.15 } = options;
  const below = targets.filter(target => target.getBoundingClientRect().top > window.innerHeight);
  // Only elements still below the fold are pre-positioned, so nothing on screen jumps.
  if (below.length) animate(below, { y, scale }, { duration: 0 });
  const done = new Set<Element>();
  // Elements entering together cascade; one arriving on its own moves at once.
  let batchStart = 0; let batchCount = 0;
  const stops = targets.map(target => inView(target, element => {
    if (done.has(element)) return;
    done.add(element);
    const now = performance.now();
    if (now - batchStart > 150) { batchStart = now; batchCount = 0; }
    const delay = Math.min(batchCount++, 6) * gap;
    animate(element, { y: [below.includes(element) ? y : y / 2, 0], scale: [scale, 1] }, { ...springs.soft, delay });
  }, { amount }));
  // Turning animations off mid-way settles everything in its resting place.
  return () => { stops.forEach(stop => stop()); animate(targets, { y: 0, scale: 1 }, { duration: 0 }); };
}

/** Undo a scroll-linked or pointer-driven transform when its effect ends. */
export function settle(elements: Element[], values: Record<string, number> = { x: 0, y: 0 }): void {
  if (elements.length) animate(elements, values, { duration: 0 });
}

export { animate, stagger };
