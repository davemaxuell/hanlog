import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IntroReveal } from '@/components/intro/IntroReveal';
import { MotionProvider, MotionToggle } from '@/components/motion/MotionPreference';

const observers: { callback: IntersectionObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  observers.length = 0;
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) { observers.push({ callback, observe: this.observe, disconnect: this.disconnect }); }
  });
});
afterEach(() => { vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-motion'); });
const enter = (index = 0) => act(() => observers[index].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

it('leaves content usable before intersection and reveals a section only once', () => {
  const { unmount } = render(<IntroReveal id="how" aria-label="How it works"><a href="#try">Try it now</a></IntroReveal>);
  const section = screen.getByRole('region', { name: 'How it works' });
  expect(section).toHaveAttribute('id', 'how');
  expect(screen.getByRole('link')).toBeVisible();
  expect(section).not.toHaveAttribute('hidden');
  expect(section).not.toHaveAttribute('data-reveal');
  enter();
  expect(section).toHaveAttribute('data-reveal', 'shown');
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  unmount();
  expect(observers[0].disconnect).toHaveBeenCalledTimes(2);
});

it.each(['device', 'preference'])('keeps content still with reduced motion from %s', source => {
  if (source === 'device') vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  else document.documentElement.dataset.motion = 'reduce';
  render(<IntroReveal aria-label="Calm section"><button>Continue</button></IntroReveal>);
  expect(observers).toHaveLength(0);
  expect(screen.getByRole('button')).toBeVisible();
});

it('does not move a section while its keyboard control has focus', () => {
  render(<IntroReveal aria-label="Focused section"><button>Continue</button></IntroReveal>);
  screen.getByRole('button').focus(); enter();
  expect(screen.getByRole('region')).toHaveAttribute('data-reveal', 'still');
  expect(screen.getByRole('button')).toHaveFocus();
});

it('remains visible when intersection observation is unavailable', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  render(<IntroReveal aria-label="Available section"><p>Available without enhancement</p></IntroReveal>);
  expect(screen.getByText('Available without enhancement')).toBeVisible();
  expect(screen.getByRole('region')).not.toHaveAttribute('data-reveal');
});

it('installs observers after the provider resolves its still server default, and cancels a pending reveal when reduced', () => {
  document.documentElement.dataset.motion = 'reduce';
  render(<MotionProvider><MotionToggle /><IntroReveal aria-label="Ready section">Readable content</IntroReveal></MotionProvider>);
  expect(document.documentElement).toHaveAttribute('data-motion', 'full');
  expect(observers).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  enter();
  expect(screen.getByRole('region')).not.toHaveAttribute('data-reveal');
  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(observers).toHaveLength(2);
  enter(1);
  expect(screen.getByRole('region')).toHaveAttribute('data-reveal', 'shown');
});

it.each(['shown', 'still'])('does not replay an already %s section after toggling motion off and on', state => {
  document.documentElement.dataset.motion = 'reduce';
  render(<MotionProvider><MotionToggle /><IntroReveal aria-label="Visited section"><button>Section action</button></IntroReveal></MotionProvider>);
  if (state === 'still') screen.getByRole('button', { name: 'Section action' }).focus();
  expect(observers).toHaveLength(1);
  enter();
  expect(screen.getByRole('region')).toHaveAttribute('data-reveal', state);
  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(observers).toHaveLength(1);
  expect(screen.getByRole('region')).toHaveAttribute('data-reveal', 'still');
});
