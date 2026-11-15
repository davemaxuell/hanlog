import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
const community = vi.hoisted(() => ({ listChallenges: vi.fn(), getInbox: vi.fn() }));
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
vi.mock('@/lib/community-client', () => ({ communityApi: community }));
import Challenges from '@/app/app/challenges/page';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';
beforeEach(() => { resetMocks(); community.listChallenges.mockReset().mockResolvedValue({ challenges: [], nextCursor: null }); community.getInbox.mockReset().mockResolvedValue({ items: [], nextCursor: null }); });
it('shows a learner the open challenges and their answers without per-card detail fetches', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  community.listChallenges.mockImplementation(async (scope: string) => ({ challenges: scope === 'open'
    ? [samples.challenge, { ...samples.challenge, id: 'c2', korean: '나 요즘 갓생 살고 있어.', viewer: { responded: true, pendingToRate: 0 } }]
    : [{ ...samples.challenge, id: 'c2', korean: '나 요즘 갓생 살고 있어.', viewer: { responded: true, pendingToRate: 0 } }], nextCursor: null }));
  render(<SessionProvider><Challenges /></SessionProvider>);
  const open = within(await screen.findByRole('region', { name: 'Open challenges' }));
  await waitFor(() => expect(open.getAllByRole('link')).toHaveLength(2));
  expect(open.getByText('Answered')).toBeInTheDocument();
  expect(open.getAllByRole('link')[0]).toHaveAttribute('href', `/app/challenges/${samples.challenge.id}`);
  expect(within(screen.getByRole('region', { name: 'My answers' })).getAllByRole('link')).toHaveLength(1);
  expect(community.listChallenges.mock.calls.map(call => call[0]).sort()).toEqual(['answered', 'open']);
  expect(mockApi.getChallenge).not.toHaveBeenCalled(); expect(screen.queryByRole('link', { name: 'Post a challenge' })).toBeNull();
});
it('shows a Korean speaker what to rate, their challenges, and the post button', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  community.listChallenges.mockImplementation(async (scope: string) => ({ challenges: scope === 'to-rate' ? [{ ...samples.challenge, viewer: { responded: false, pendingToRate: 3 } }] : [], nextCursor: null }));
  render(<SessionProvider><Challenges /></SessionProvider>);
  expect(await screen.findByRole('heading', { name: 'To rate (3)' })).toBeInTheDocument();
  expect(screen.getByText('You have not posted a challenge yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Post a challenge' })).toHaveAttribute('href', '/app/challenges/new');
  expect(community.listChallenges.mock.calls.map(call => call[0]).sort()).toEqual(['mine', 'to-rate']);
});
it('keeps available challenges visible when the feedback inbox fails', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  community.listChallenges.mockResolvedValue({ challenges: [samples.challenge], nextCursor: null });
  community.getInbox.mockRejectedValue(new Error('offline'));
  render(<SessionProvider><Challenges /></SessionProvider>);
  expect(await screen.findByText('Feedback could not load. Your challenges are still available.')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Open challenges' })).getByRole('link')).toHaveAttribute('href', `/app/challenges/${samples.challenge.id}`);
});
it('searches on submission and validates a shared challenge code', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  render(<SessionProvider><Challenges /></SessionProvider>);
  await screen.findByLabelText('Find an expression');
  await userEvent.type(screen.getByLabelText('Find an expression'), 'coffee');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await waitFor(() => expect(community.listChallenges).toHaveBeenCalledWith('open', expect.objectContaining({ q: 'coffee' })));
  await userEvent.click(screen.getByRole('button', { name: 'Open code' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter the six-character challenge code.');
  await userEvent.type(screen.getByLabelText('Have an invitation?'), 'abc234');
  await userEvent.click(screen.getByRole('button', { name: 'Open code' }));
  expect(nav.push).toHaveBeenCalledWith('/c/ABC234');
});
it('appends the next page and preserves existing cards', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  community.listChallenges.mockImplementation(async (scope: string, options: { cursor?: string }) => ({ challenges: scope !== 'open' ? [] : options.cursor ? [{ ...samples.challenge, id: 'older', korean: '반가워요' }] : [samples.challenge], nextCursor: scope === 'open' && !options.cursor ? 'next-page' : null }));
  render(<SessionProvider><Challenges /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'More challenges' }));
  expect(await screen.findByText('반가워요')).toHaveAttribute('lang', 'ko');
  expect(within(screen.getByRole('region', { name: 'Open challenges' })).getAllByRole('link')).toHaveLength(2);
});
