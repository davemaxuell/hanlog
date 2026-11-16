import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppTour } from '@/components/intro/AppTour';
import { MotionProvider } from '@/components/motion/MotionPreference';

const observers: IntersectionObserverCallback[] = [];
beforeEach(() => {
  localStorage.clear();
  observers.length = 0;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn(); disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) { observers.push(callback); }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-motion'); });

const renderTour = () => render(<MotionProvider><AppTour /></MotionProvider>);
const stepButton = (name: string) => screen.getByRole('button', { name });
const phone = () => screen.getByRole('figure');
const enterView = () => act(() => { for (const callback of observers) callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver); });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('shows each how-it-works step on an illustrated phone screen', async () => {
  localStorage.setItem('hl_motion_reduced', 'true');
  const { container } = renderTour();
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Find your words', 'Give it a voice', 'Make a connection', 'Keep the good bits']);
  expect(stepButton('Find your words')).toHaveAttribute('aria-pressed', 'true');
  expect(phone()).toHaveAccessibleName(/practice missions/i);

  await userEvent.click(stepButton('Give it a voice'));
  expect(stepButton('Give it a voice')).toHaveAttribute('aria-pressed', 'true');
  expect(stepButton('Find your words')).toHaveAttribute('aria-pressed', 'false');
  // Still mode skips the recording animation and shows the scored result.
  expect(phone()).toHaveAccessibleName(/overall score of 88.*\+10 points/i);

  await userEvent.click(stepButton('Make a connection'));
  expect(phone()).toHaveAccessibleName(/rated your answer.*\+27 points/i);
  await userEvent.click(stepButton('Keep the good bits'));
  expect(phone()).toHaveAccessibleName(/streak/i);

  // The phone is a picture of the app: nothing inside it can be focused or announced twice.
  const replica = container.querySelector('[data-phone-screen]')!;
  expect(replica).toHaveAttribute('aria-hidden', 'true');
  expect(replica.querySelectorAll('a, button, input, select, textarea, [tabindex]')).toHaveLength(0);

  expect(within(container).getByText(/Illustrated screens/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Try the real thing' })).toHaveAttribute('href', '#try');
  expect(screen.queryByRole('button', { name: /app tour/ })).not.toBeInTheDocument();
});

it('plays through recording and scoring while in view, and stops when paused', () => {
  vi.useFakeTimers();
  renderTour();
  advance(10_000);
  expect(stepButton('Find your words')).toHaveAttribute('aria-pressed', 'true');

  enterView();
  expect(screen.getByRole('button', { name: 'Pause the app tour' })).toBeInTheDocument();
  advance(4_600);
  expect(stepButton('Give it a voice')).toHaveAttribute('aria-pressed', 'true');
  expect(phone()).toHaveAccessibleName(/recording/i);
  advance(2_600);
  expect(phone()).toHaveAccessibleName(/checking/i);
  advance(1_200);
  expect(phone()).toHaveAccessibleName(/overall score of 88/i);

  fireEvent.click(screen.getByRole('button', { name: 'Pause the app tour' }));
  advance(30_000);
  expect(stepButton('Give it a voice')).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Play the app tour' }));
  advance(5_000);
  expect(stepButton('Make a connection')).toHaveAttribute('aria-pressed', 'true');
});

it('stays on the step a visitor chooses', () => {
  vi.useFakeTimers();
  renderTour();
  enterView();
  fireEvent.click(stepButton('Keep the good bits'));
  advance(30_000);
  expect(stepButton('Keep the good bits')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Play the app tour' })).toBeInTheDocument();
});
