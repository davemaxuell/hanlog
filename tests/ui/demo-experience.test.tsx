import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AttemptResult } from '@/lib/contracts';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async original => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
vi.mock('@/components/demo/LivePractice', () => ({ LivePractice: ({ onScored, onActivityChange }: { onScored(result: AttemptResult): void; onActivityChange(active: boolean): void }) => <div>
  <input aria-label="Test editable field" />
  <button onClick={() => onActivityChange(true)}>Begin capture</button>
  <button onClick={() => onActivityChange(false)}>Stop capture</button>
  <button onClick={() => onScored(samples.attemptResult)}>Finish simulated live attempt</button>
</div> }));
vi.mock('@/components/demo/DemoPreparation', () => ({ DemoPreparation: ({ onClose }: { onClose(): void }) => <button onClick={onClose}>Close preparation</button> }));
vi.mock('@/components/demo/DemoFeedback', () => ({ DemoFeedback: ({ mode, result }: { mode: string; result: AttemptResult | null }) => <h2>{mode === 'live' && result ? `Live result ${result.attempt.score.overall}` : 'Illustrative feedback'}</h2> }));
vi.mock('@/components/demo/DemoConnection', () => ({ DemoConnection: () => <h2>Illustrative peer exchange</h2> }));
vi.mock('@/components/demo/DemoProgress', () => ({ DemoProgress: ({ mode, result }: { mode: string; result: AttemptResult | null }) => <h2>{mode === 'live' && result ? 'Real practice saved' : 'Example practice journal'}</h2> }));
import { DemoExperience } from '@/components/demo/DemoExperience';
import { getMission, getSampleChallenges } from '@/lib/content';
import { samples } from '../fixtures/api/samples';
import { mockApi, resetMocks } from './_helpers';
beforeEach(() => {
  resetMocks();
  window.scrollTo = vi.fn();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
const setup = () => render(<DemoExperience mission={getMission('cafe-iced-americano')!} challenge={getSampleChallenges()[0]} missionCount={24} />);

it('walks through an example and restarts without touching an account or scoring', async () => {
  setup();
  expect(screen.getByRole('button', { name: 'Example walkthrough' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Next: Feedback' }));
  expect(screen.getByRole('heading', { name: 'Illustrative feedback' })).toBeInTheDocument();
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  await userEvent.click(screen.getByRole('button', { name: 'Next: People' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next: Progress' }));
  expect(screen.getByRole('heading', { name: 'Example practice journal' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Restart walkthrough' }));
  expect(screen.getByRole('heading', { name: 'One phrase can open a conversation.' })).toBeInTheDocument();
  for (const name of ['getSession', 'createSession', 'submitAttempt', 'deleteSession'] as const) expect(mockApi[name]).not.toHaveBeenCalled();
});
it('guards live result scenes and blocks navigation during capture without blocking the explicit fallback link', async () => {
  setup(); await userEvent.click(screen.getByRole('button', { name: 'Live practice' }));
  expect(screen.getByRole('button', { name: 'Next: Feedback' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Begin capture' }));
  expect(screen.getByRole('button', { name: 'Example walkthrough' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Restart walkthrough' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Stop capture' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open example in a new tab/ })).toHaveAttribute('href', '/demo');
  await userEvent.click(screen.getByRole('button', { name: 'Stop capture' }));
  await userEvent.click(screen.getByRole('button', { name: 'Finish simulated live attempt' }));
  expect(screen.getByRole('heading', { name: 'Live result 88' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Example walkthrough' }));
  await userEvent.click(screen.getByRole('button', { name: 'Next: Feedback' }));
  expect(screen.getByRole('heading', { name: 'Illustrative feedback' })).toBeInTheDocument();
  expect(screen.queryByText('Live result 88')).not.toBeInTheDocument();
});
it('supports arrows from the stage but leaves typing and preparation controls alone', async () => {
  setup(); fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('heading', { name: 'Illustrative feedback' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  await userEvent.click(screen.getByRole('button', { name: 'Live practice' }));
  fireEvent.keyDown(screen.getByLabelText('Test editable field'), { key: 'ArrowRight' });
  expect(screen.queryByText('Illustrative feedback')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Prepare demo' }));
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Close preparation' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Close preparation' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('clears a completed presentation result when another app tab announces a profile change', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Live practice' }));
  await userEvent.click(screen.getByRole('button', { name: 'Finish simulated live attempt' }));
  expect(screen.getByRole('heading', { name: 'Live result 88' })).toBeVisible();
  fireEvent(window, new StorageEvent('storage', { key: 'hl_session_changed' }));
  expect(screen.queryByRole('heading', { name: 'Live result 88' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Example walkthrough' })).toHaveAttribute('aria-pressed', 'true');
  expect(mockApi.deleteSession).not.toHaveBeenCalled();
});
