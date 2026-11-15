import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));

import Onboarding from '@/app/app/onboarding/page';
import { AppShell } from '@/components/ui/AppShell';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider, safeNext, useSession } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';

beforeEach(resetMocks);
const Who = () => <p>Hello {useSession().user.nickname}</p>;

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
  nav.pathname = '/app/rewards';
  render(<SessionProvider><AppShell><Who /></AppShell></SessionProvider>);
  expect(await screen.findByText(`Hello ${samples.user.nickname}`)).toBeInTheDocument();
  expect(await screen.findByText('★ 120 points')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Rewards' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(expect.arrayContaining(['/app', '/app/challenges', '/app/rewards', '/app/me']));
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
