import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
vi.mock('@/lib/account-client', () => ({ accountApi: { status: vi.fn().mockResolvedValue({ recoveryEnabled: true, recoveryUpdatedAt: null }) } }));

import Onboarding from '@/app/app/onboarding/page';
import { AppShell } from '@/components/ui/AppShell';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider, safeNext, useSession, useOptionalSession } from '@/lib/ui/session-context';
import type { User } from '@/lib/contracts';
import { useAction } from '@/lib/ui/use-action';
import { useApi } from '@/lib/ui/use-api';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';

beforeEach(resetMocks);
const Who = () => <p>Hello {useSession().user.nickname}</p>;
const CurrentProfile = () => <p>Current profile: {useOptionalSession().user?.nickname ?? 'none'}</p>;
function BalanceProbe() {
  const session = useSession();
  return <><p>Balance: {session.balance === null ? 'unavailable' : session.balance}</p><button onClick={() => void session.refreshBalance()}>Refresh balance</button></>;
}
function ExpirationProbe({ kind }: { kind: 'read' | 'action' }) {
  const action = useAction();
  useApi(() => kind === 'read' ? Promise.reject(new ApiClientError('unauthenticated', 401, 'expired')) : Promise.resolve('ready'), [kind]);
  return <button onClick={() => void action.run(() => Promise.reject(new ApiClientError('unauthenticated', 401, 'expired')))}>Expire session</button>;
}

it.each(['read', 'action'] as const)('clears cached authentication after an expired %s so onboarding cannot bounce back', async kind => {
  mockApi.getSession.mockResolvedValue(samples.user);
  nav.pathname = '/app/challenges';
  const view = render(<SessionProvider><ExpirationProbe kind={kind} /></SessionProvider>);
  if (kind === 'action') await userEvent.click(await screen.findByRole('button', { name: 'Expire session' }));
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fapp%2Fchallenges'));
  nav.pathname = '/app/onboarding'; nav.replace.mockClear();
  view.rerender(<SessionProvider><Onboarding /><CurrentProfile /></SessionProvider>);
  expect(await screen.findByText('Current profile: none')).toBeInTheDocument();
  expect(nav.replace).not.toHaveBeenCalledWith('/app');
});
it('does not let an older initial balance overwrite a newer refresh', async () => {
  let finishInitial!: (value: { balance: number; events: [] }) => void;
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockReturnValueOnce(new Promise(resolve => { finishInitial = resolve; })).mockResolvedValueOnce({ balance: 80, events: [] });
  render(<SessionProvider><BalanceProbe /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Refresh balance' }));
  expect(await screen.findByText('Balance: 80')).toBeInTheDocument();
  await act(async () => { finishInitial({ balance: 10, events: [] }); });
  expect(screen.getByText('Balance: 80')).toBeInTheDocument();
});
it('offers a points retry after failure and distinguishes unavailable from zero', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockRejectedValueOnce(new ApiClientError('internal', 503, 'offline')).mockResolvedValueOnce({ balance: 0, events: [] });
  render(<SessionProvider><AppShell><Who /></AppShell></SessionProvider>);
  const retry = await screen.findByRole('button', { name: 'Retry points' });
  expect(screen.queryByText('★ 0 points')).toBeNull();
  await userEvent.click(retry);
  expect(await screen.findByText('★ 0 points')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retry points' })).toBeNull();
});
it('ignores a late failed balance refresh after the provider unmounts', async () => {
  let rejectBalance!: (cause: unknown) => void;
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValueOnce({ balance: 10, events: [] }).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectBalance = reject; }));
  const view = render(<SessionProvider><BalanceProbe /></SessionProvider>);
  await screen.findByText('Balance: 10');
  await userEvent.click(screen.getByRole('button', { name: 'Refresh balance' }));
  view.unmount();
  await act(async () => { rejectBalance(new ApiClientError('unauthenticated', 401, 'late')); });
  expect(nav.replace).not.toHaveBeenCalled();
});

it('keeps a newly created profile when the initial session lookup finishes late', async () => {
  let finishLookup!: (user: User | null) => void;
  mockApi.getSession.mockReturnValue(new Promise<User | null>(resolve => { finishLookup = resolve; }));
  mockApi.createSession.mockResolvedValue(samples.user);
  nav.pathname = '/app/onboarding';
  render(<SessionProvider><Onboarding /><CurrentProfile /></SessionProvider>);
  await userEvent.type(screen.getByLabelText('Nickname'), 'Aisha');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(await screen.findByText('Current profile: Aisha')).toBeInTheDocument();
  await act(async () => { finishLookup(null); });
  expect(screen.getByText('Current profile: Aisha')).toBeInTheDocument();
});

it('only follows safe next paths', () => {
  expect(safeNext('/app/challenges/abc')).toBe('/app/challenges/abc');
  expect(safeNext('/c/ABC234')).toBe('/c/ABC234');
  for (const bad of [null, '', 'https://evil.example', '//evil.example', '/api/session', '/apple', 'javascript:alert(1)']) expect(safeNext(bad)).toBe('/app');
});
it('sends a visitor to onboarding and remembers where they were going', async () => {
  mockApi.getSession.mockResolvedValue(null);
  nav.pathname = '/app/challenges/abc';
  render(<SessionProvider><Who /></SessionProvider>);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fapp%2Fchallenges%2Fabc'));
  expect(screen.queryByText(/Hello/)).toBeNull();
});
it('renders the app for a signed-in user with balance and navigation', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValue({ balance: 120, events: [] });
  nav.pathname = '/app/progress';
  render(<SessionProvider><AppShell><Who /></AppShell></SessionProvider>);
  expect(await screen.findByText(`Hello ${samples.user.nickname}`)).toBeInTheDocument();
  expect(await screen.findByText('★ 120 points')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Your points and milestones' })).toHaveAttribute('href', '/app/rewards');
  expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining(['/app', '/app/missions', '/app/challenges', '/app/progress', '/app/me']));
});
it('onboards with nickname, role, and consent', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  nav.pathname = '/app/onboarding';
  nav.search = new URLSearchParams('next=/c/ABC234');
  render(<SessionProvider><Onboarding /></SessionProvider>);
  const start = await screen.findByRole('button', { name: 'Start' });
  expect(start).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Nickname'), 'Aisha');
  await userEvent.click(screen.getByRole('radio', { name: /I'm learning Korean/ }));
  expect(start).toBeDisabled();                                   // consent still missing
  await userEvent.click(screen.getByRole('checkbox', { name: /I agree that my voice recordings are sent to OpenAI/ }));
  await userEvent.click(start);
  expect(mockApi.createSession).toHaveBeenCalledWith({ nickname: 'Aisha', role: 'learner' });
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/c/ABC234'));
});
it('shows the server reason when a nickname is rejected', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockRejectedValue(new ApiClientError('content_rejected', 422, 'x'));
  nav.pathname = '/app/onboarding';
  render(<SessionProvider><Onboarding /></SessionProvider>);
  await userEvent.type(await screen.findByLabelText('Nickname'), 'Aisha');
  await userEvent.click(screen.getByRole('radio', { name: /I speak Korean/ }));
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please rephrase that. We keep HanLog friendly for everyone.');
  expect(nav.replace).not.toHaveBeenCalledWith('/app');
});
