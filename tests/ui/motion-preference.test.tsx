import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MotionProvider, MotionToggle } from '@/components/motion/MotionPreference';

let mediaChange: (() => void) | undefined;
let deviceReduced = false;
beforeEach(() => {
  localStorage.clear(); document.documentElement.dataset.motion = 'reduce'; deviceReduced = false; mediaChange = undefined;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return deviceReduced; }, addEventListener: (_: string, cb: () => void) => { mediaChange = cb; }, removeEventListener: vi.fn() })));
});
const mount = () => render(<MotionProvider><MotionToggle /><input aria-label="Unsent draft" defaultValue="Keep this" /></MotionProvider>);

it('saves a local reduced-motion choice and preserves mounted content while toggling', async () => {
  const { unmount } = mount();
  const draft = screen.getByRole('textbox');
  await userEvent.type(draft, ' recording');
  await userEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
  expect(localStorage.getItem('hl_motion_reduced')).toBe('true');
  expect(screen.getByRole('button', { name: 'Reduce animations' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('textbox')).toBe(draft);
  expect(draft).toHaveValue('Keep this recording');
  unmount(); mount();
  expect(screen.getByRole('button', { name: 'Reduce animations' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(document.documentElement).toHaveAttribute('data-motion', 'full');
});
it('follows changing device preferences and never overrides an OS request for reduced motion', () => {
  mount();
  act(() => { deviceReduced = true; mediaChange?.(); });
  expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
  expect(screen.getByRole('button', { name: 'Reduce animations' })).toBeDisabled();
  act(() => { deviceReduced = false; mediaChange?.(); });
  expect(screen.getByRole('button', { name: 'Reduce animations' })).toBeEnabled();
  expect(document.documentElement).toHaveAttribute('data-motion', 'full');
});
it('syncs the preference across tabs and stays usable if browser storage is blocked', async () => {
  mount();
  fireEvent(window, new StorageEvent('storage', { key: 'hl_motion_reduced', newValue: 'true' }));
  expect(document.documentElement).toHaveAttribute('data-motion', 'reduce');
  const blocked = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  await userEvent.click(screen.getByRole('button', { name: 'Reduce animations' }));
  expect(document.documentElement).toHaveAttribute('data-motion', 'full');
  blocked.mockRestore();
});
