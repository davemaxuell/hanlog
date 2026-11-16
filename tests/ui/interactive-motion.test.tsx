import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HeroWindow } from '@/components/intro/HeroWindow';
import { ExchangeShowcase } from '@/components/intro/ExchangeShowcase';
import { MotionProvider, MotionToggle } from '@/components/motion/MotionPreference';
import { PointsChip, Stars } from '@/components/ui';
import { Recorder } from '@/components/recorder/Recorder';
import { fakeDeps } from './_fakes';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-motion');
});

it('HeroWindow switches everyday sample phrases and updates the practice link', async () => {
  render(<MotionProvider><HeroWindow /></MotionProvider>);
  expect(screen.getByRole('link', { name: /Practise this phrase/ })).toHaveAttribute('href', '/app/missions/cafe-iced-americano');
  await userEvent.click(screen.getByRole('button', { name: 'Campus' }));
  expect(screen.getByRole('button', { name: 'Campus' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/Nice to meet you\./)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Practise this phrase/ })).toHaveAttribute('href', '/app/missions/greet-nice-to-meet');
  await userEvent.click(screen.getByRole('button', { name: 'Question' }));
  expect(screen.getByRole('link', { name: /Practise this phrase/ })).toHaveAttribute('href', '/app/missions/campus-restroom');
});

it('HeroWindow applies mouse parallax tilt only when animations are active', () => {
  const { container } = render(<MotionProvider><MotionToggle /><HeroWindow /></MotionProvider>);
  const card = container.querySelector('[class*="window"]') as HTMLElement;
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 300, right: 200, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.pointerMove(card, { pointerType: 'mouse', clientX: 160, clientY: 60 });
  expect(card.style.getPropertyValue('--tilt-x')).not.toBe('');
  fireEvent.pointerLeave(card);
  expect(card.style.getPropertyValue('--tilt-x')).toBe('0deg');
  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  card.style.setProperty('--tilt-x', '');
  fireEvent.pointerMove(card, { pointerType: 'mouse', clientX: 160, clientY: 60 });
  expect(card.style.getPropertyValue('--tilt-x')).toBe('');
});

it('ExchangeShowcase plays the wave ripple and settles cleanly without animating under reduced motion', () => {
  vi.useFakeTimers();
  const { container } = render(<MotionProvider><MotionToggle /><ExchangeShowcase /></MotionProvider>);
  const preview = screen.getByRole('button', { name: 'Preview voice wave' });
  fireEvent.click(preview);
  const wave = container.querySelector('[aria-hidden="true"][class*="wave"]')!;
  expect(screen.getByRole('button', { name: 'Stop voice wave preview' })).toHaveAttribute('aria-pressed', 'true');
  expect(wave).toHaveAttribute('data-playing', 'true');
  act(() => { vi.advanceTimersByTime(1700); });
  expect(screen.getByRole('button', { name: 'Preview voice wave' })).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview voice wave' }));
  expect(screen.getByRole('button', { name: 'Stop voice wave preview' })).toHaveAttribute('aria-pressed', 'true');
  expect(wave).not.toHaveAttribute('data-playing');
});

it('Stars previews hover ratings across prior labels and marks filled stars', () => {
  const { container } = render(<Stars label="Flow" value={3} onChange={vi.fn()} />);
  const labels = Array.from(container.querySelectorAll('.hl-stars label'));
  expect(labels[0]).toHaveClass('is-filled');
  expect(labels[1]).toHaveClass('is-filled');
  expect(labels[2]).toHaveClass('is-selected');
  fireEvent.pointerEnter(labels[3]);
  expect(labels.slice(0, 4).every(label => label.classList.contains('is-preview'))).toBe(true);
  expect(labels[4]).not.toHaveClass('is-preview');
  fireEvent.pointerLeave(container.querySelector('.hl-stars')!);
  expect(labels.some(label => label.classList.contains('is-preview'))).toBe(false);
});

it('PointsChip bumps on balance increases unless animations are reduced', async () => {
  vi.useFakeTimers();
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 1; });
  const { rerender } = render(<MotionProvider><MotionToggle /><PointsChip balance={10} /></MotionProvider>);
  rerender(<MotionProvider><MotionToggle /><PointsChip balance={30} /></MotionProvider>);
  expect(screen.getByTestId('points-balance')).toHaveClass('hl-points--bump');
  act(() => { vi.advanceTimersByTime(500); });
  expect(screen.getByTestId('points-balance')).not.toHaveClass('hl-points--bump');

  fireEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  rerender(<MotionProvider><MotionToggle /><PointsChip balance={50} /></MotionProvider>);
  expect(screen.getByTestId('points-balance')).not.toHaveClass('hl-points--bump');
  raf.mockRestore();
});

it('Recorder renders five reactive equalizer bars alongside the meter while recording', async () => {
  const deps = fakeDeps();
  const { container } = render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={vi.fn()} deps={deps} />);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  expect(screen.getByRole('meter', { name: 'Microphone level' }).querySelector('span')?.style.transform).toMatch(/^scaleX\(/);
  const bars = container.querySelectorAll('.hl-level-bars i');
  expect(bars).toHaveLength(5);
  expect(container.querySelector('.hl-level-bars')).toHaveAttribute('aria-hidden', 'true');
});
