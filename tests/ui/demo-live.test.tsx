import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async original => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import { LivePractice } from '@/components/demo/LivePractice';
import { ApiClientError } from '@/lib/api-client';
import type { User } from '@/lib/contracts';
import { CONSENT_TEXT } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { toneWav } from '../helpers/audio';
import { fakeDeps } from './_fakes';
import { mockApi, resetMocks } from './_helpers';

beforeEach(resetMocks);
const mission = samples.missions[0];
const start = async () => {
  await userEvent.click(screen.getByRole('checkbox', { name: CONSENT_TEXT }));
  await userEvent.click(screen.getByRole('button', { name: 'Start live practice' }));
};

it('requires consent and an explicit start before checking or creating a session', async () => {
  const deps = fakeDeps();
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  render(<LivePractice mission={mission} onScored={vi.fn()} deps={deps} />);
  fireEvent.focus(window);
  fireEvent(window, new StorageEvent('storage', { key: 'hl_session_changed' }));
  expect(screen.getByRole('button', { name: 'Start live practice' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox', { name: CONSENT_TEXT }));
  expect(mockApi.getSession).not.toHaveBeenCalled();
  expect(mockApi.createSession).not.toHaveBeenCalled();
  expect(deps.streams).toHaveLength(0);
  await userEvent.dblClick(screen.getByRole('button', { name: 'Start live practice' }));
  expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Video' })).not.toBeInTheDocument();
  expect(screen.getByText('Use a saved voice file')).toBeVisible();
  expect(screen.getByRole('heading', { level: 2, name: mission.korean })).toHaveAttribute('lang', 'ko');
  expect(mockApi.getSession).toHaveBeenCalledTimes(1);
  expect(mockApi.createSession).toHaveBeenCalledExactlyOnceWith({ nickname: expect.stringMatching(/^Guest \d{4}$/), role: 'learner' });
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
  expect(screen.getByText(/Results are saved to the profile used in this browser/)).toBeInTheDocument();
});

it('reuses the current profile without changing its role or creating another profile', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  render(<LivePractice mission={mission} onScored={vi.fn()} deps={fakeDeps()} />);
  await start();
  expect(await screen.findByText(/Practicing as Minji/)).toBeInTheDocument();
  expect(mockApi.createSession).not.toHaveBeenCalled();
  expect(mockApi.updateSession).not.toHaveBeenCalled();
  expect(mockApi.deleteSession).not.toHaveBeenCalled();
});

it('does not create a profile after the user leaves during a session check', async () => {
  let resolve!: (user: User | null) => void;
  mockApi.getSession.mockReturnValue(new Promise(value => { resolve = value; }));
  const activity = vi.fn();
  const { unmount } = render(<LivePractice mission={mission} onScored={vi.fn()} onActivityChange={activity} deps={fakeDeps()} />);
  await start();
  expect(activity).toHaveBeenLastCalledWith(true);
  unmount();
  expect(activity).toHaveBeenLastCalledWith(false);
  await act(async () => { resolve(null); });
  expect(mockApi.createSession).not.toHaveBeenCalled();
});

it('shows session failures and allows an explicit retry without starting a recorder', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockRejectedValueOnce(new ApiClientError('daily_limit', 429, 'limit')).mockResolvedValueOnce(samples.user);
  render(<LivePractice mission={mission} onScored={vi.fn()} deps={fakeDeps()} />);
  await start();
  expect(await screen.findByRole('alert')).toHaveTextContent('You have reached today’s limit for this action. Try again tomorrow.');
  expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Start live practice' }));
  expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
  expect(mockApi.createSession).toHaveBeenCalledTimes(2);
});

it('only sends a recording after Get my score and forwards the actual result once', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.submitAttempt.mockResolvedValue(samples.attemptResult);
  const onScored = vi.fn(); const activity = vi.fn(); const deps = fakeDeps();
  render(<LivePractice mission={mission} onScored={onScored} onActivityChange={activity} deps={deps} convert={async () => toneWav(1000)} />);
  await start();
  await userEvent.click(await screen.findByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  expect(activity).toHaveBeenLastCalledWith(true);
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await screen.findByRole('button', { name: 'Get my score' });
  expect(activity).toHaveBeenLastCalledWith(true);
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Get my score' }));
  await waitFor(() => expect(onScored).toHaveBeenCalledExactlyOnceWith(samples.attemptResult));
  expect(mockApi.submitAttempt).toHaveBeenCalledTimes(1);
  expect(mockApi.getSession).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(activity).toHaveBeenLastCalledWith(false));
});

it.each(['focus', 'storage', 'visibilitychange'])('discards a ready clip and requires consent again when %s reveals a changed profile', async event => {
  mockApi.getSession.mockResolvedValueOnce(samples.user).mockResolvedValue(samples.koreanUser);
  const deps = fakeDeps(); const activity = vi.fn();
  render(<LivePractice mission={mission} onScored={vi.fn()} onActivityChange={activity} deps={deps} />);
  await start();
  await userEvent.click(await screen.findByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await screen.findByRole('button', { name: 'Get my score' });
  if (event === 'storage') fireEvent(window, new StorageEvent('storage', { key: 'hl_session_changed' }));
  else if (event === 'focus') fireEvent.focus(window);
  else fireEvent(document, new Event('visibilitychange'));
  expect(await screen.findByRole('alert')).toHaveTextContent('The profile used in this browser has changed.');
  expect(screen.getByRole('checkbox', { name: CONSENT_TEXT })).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Start live practice' })).toBeDisabled();
  expect(screen.queryByLabelText('Recording preview')).not.toBeInTheDocument();
  await waitFor(() => expect(activity).toHaveBeenLastCalledWith(false));
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
  expect(mockApi.createSession).not.toHaveBeenCalled();
  expect(mockApi.updateSession).not.toHaveBeenCalled();
  await start();
  expect(await screen.findByText(/Practicing as Minji/)).toBeVisible();
  expect(mockApi.createSession).not.toHaveBeenCalled();
});

it.each(['changed profile', 'offline'])('fails closed before scoring if the final profile check finds %s', async failure => {
  mockApi.getSession.mockResolvedValueOnce(samples.user);
  if (failure === 'changed profile') mockApi.getSession.mockResolvedValue(samples.koreanUser);
  else mockApi.getSession.mockRejectedValue(new ApiClientError('internal', 0, 'offline'));
  const deps = fakeDeps(); const convert = vi.fn(async () => toneWav(1000));
  render(<LivePractice mission={mission} onScored={vi.fn()} deps={deps} convert={convert} />);
  await start();
  await userEvent.click(await screen.findByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(failure === 'changed profile' ? 'The profile used in this browser has changed.' : "We couldn't verify the profile used in this browser.");
  expect(convert).toHaveBeenCalledTimes(1);
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox', { name: CONSENT_TEXT })).not.toBeChecked();
  expect(screen.queryByLabelText('Recording preview')).not.toBeInTheDocument();
});

it('ignores an old profile check after consent has started a new profile view', async () => {
  let staleCheck!: (user: User) => void;
  mockApi.getSession.mockResolvedValueOnce(samples.user)
    .mockReturnValueOnce(new Promise(resolve => { staleCheck = resolve; }))
    .mockResolvedValue(samples.koreanUser);
  render(<LivePractice mission={mission} onScored={vi.fn()} deps={fakeDeps()} />);
  await start();
  await screen.findByRole('button', { name: 'Record' });
  fireEvent.focus(window);
  fireEvent(window, new StorageEvent('storage', { key: 'hl_session_changed' }));
  await screen.findByRole('alert');
  await start();
  expect(await screen.findByText(/Practicing as Minji/)).toBeVisible();
  await act(async () => { staleCheck(samples.user); });
  expect(screen.getByText(/Practicing as Minji/)).toBeVisible();
  expect(screen.queryByText(/Practicing as Aisha/)).not.toBeInTheDocument();
  expect(mockApi.createSession).not.toHaveBeenCalled();
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});
