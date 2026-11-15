import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
import { MotionProvider, MotionToggle } from '@/components/motion/MotionPreference';
import { RouteEntrance } from '@/components/motion/RouteEntrance';
import { nav } from './_helpers';

const cancel = vi.fn();
const animate = vi.fn(() => ({ cancel }));
beforeEach(() => {
  localStorage.clear(); nav.pathname = '/app'; cancel.mockClear(); animate.mockClear();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate;
});
const tree = () => <MotionProvider><MotionToggle /><RouteEntrance><input aria-label="Draft" defaultValue="My words" /></RouteEntrance></MotionProvider>;
it('cancels a route entrance when motion is reduced without replacing an active draft', async () => {
  render(tree());
  expect(animate).toHaveBeenCalled();
  const input = screen.getByRole('textbox');
  await userEvent.type(input, ' stay');
  await userEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toBe(input);
  expect(input).toHaveValue('My words stay');
});
it('keeps the same child during pathname updates and skips entry when keyboard focus is active', async () => {
  const { rerender } = render(tree());
  const input = screen.getByRole('textbox');
  await userEvent.tab(); await userEvent.tab();
  expect(input).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Enter' });
  input.blur(); // Routers can move focus before the next route commits.
  animate.mockClear(); nav.pathname = '/app/missions'; rerender(tree());
  expect(animate).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toBe(input);
});
