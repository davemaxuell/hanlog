import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import Challenges from '@/app/app/challenges/page';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, resetMocks } from './_helpers';
beforeEach(resetMocks);
it('shows a learner the open challenges and their answers', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.listChallenges.mockImplementation(async (scope: string) => scope === 'open'
    ? [samples.challenge, { ...samples.challenge, id: 'c2', korean: '나 요즘 갓생 살고 있어.', viewer: { responded: true, pendingToRate: 0 } }]
    : scope === 'answered' ? [{ ...samples.challenge, id: 'c2', korean: '나 요즘 갓생 살고 있어.', viewer: { responded: true, pendingToRate: 0 } }] : []);
  render(<SessionProvider><Challenges /></SessionProvider>);
  const open = within(await screen.findByRole('region', { name: 'Open challenges' }));
  expect(open.getAllByRole('link')).toHaveLength(2);
  expect(open.getByText('Answered')).toBeInTheDocument();
  expect(open.getAllByRole('link')[0]).toHaveAttribute('href', `/app/challenges/${samples.challenge.id}`);
  expect(within(screen.getByRole('region', { name: 'My answers' })).getAllByRole('link')).toHaveLength(1);
  expect(mockApi.listChallenges.mock.calls.map((c) => c[0]).sort()).toEqual(['answered', 'open']);
  expect(screen.queryByRole('link', { name: 'Post a challenge' })).toBeNull();
});
it('shows a Korean speaker what to rate, their own challenges, and the post button', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.listChallenges.mockImplementation(async (scope: string) => scope === 'to-rate' ? [{ ...samples.challenge, viewer: { responded: false, pendingToRate: 3 } }] : []);
  render(<SessionProvider><Challenges /></SessionProvider>);
  expect(await screen.findByRole('heading', { name: 'To rate (3)' })).toBeInTheDocument();
  expect(screen.getByText('You have not posted a challenge yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Post a challenge' })).toHaveAttribute('href', '/app/challenges/new');
  expect(mockApi.listChallenges.mock.calls.map((c) => c[0]).sort()).toEqual(['mine', 'to-rate']);
});
