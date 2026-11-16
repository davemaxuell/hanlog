import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { motionAllowed, riseOnView } from '@/components/motion/kit';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { LandingMotion } from '@/components/intro/LandingMotion';
import { MotionProvider } from '@/components/motion/MotionPreference';

let reduceDevice = false;
const observed: Element[] = [];
beforeEach(() => {
  localStorage.clear(); reduceDevice = false; observed.length = 0;
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('reduce') ? reduceDevice : false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('IntersectionObserver', class { observe(element: Element) { observed.push(element); } unobserve() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-motion'); });

it('allows motion only when neither HanLog nor the device asks for stillness', () => {
  document.documentElement.dataset.motion = 'full';
  expect(motionAllowed()).toBe(true);
  document.documentElement.dataset.motion = 'reduce';
  expect(motionAllowed()).toBe(false);
  document.documentElement.dataset.motion = 'full'; reduceDevice = true;
  expect(motionAllowed()).toBe(false);
});

it('watches nothing and moves nothing when animations are reduced', () => {
  document.documentElement.dataset.motion = 'reduce';
  const card = document.createElement('article');
  document.body.append(card);
  const stop = riseOnView([card]);
  expect(observed).toEqual([]);
  expect(card.style.transform).toBe('');
  stop(); card.remove();
});

it('keeps the landing page still, with no progress line movement, when animations are reduced', () => {
  localStorage.setItem('hl_motion_reduced', 'true');
  document.body.innerHTML = '<section data-section="hero"><div><h1><span data-hero-word><span>Your</span></span></h1></div><div></div></section>';
  render(<MotionProvider><LandingMotion /></MotionProvider>);
  const word = document.querySelector('[data-hero-word] > span') as HTMLElement;
  expect(word.style.transform).toBe('');
  expect(observed).toEqual([]);
});

it('shows numbers directly when animations are reduced', async () => {
  localStorage.setItem('hl_motion_reduced', 'true');
  const { rerender } = render(<MotionProvider><AnimatedNumber value={40} from={0} /></MotionProvider>);
  expect(screen.getByText('40')).toBeInTheDocument();
  rerender(<MotionProvider><AnimatedNumber value={55} from={0} /></MotionProvider>);
  await act(async () => {});
  expect(screen.getByText('55')).toBeInTheDocument();
});
