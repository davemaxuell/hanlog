import { render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import Rewards from '@/app/app/rewards/page';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, resetMocks } from './_helpers';
beforeEach(resetMocks);
it('shows balance, example coupons with progress, and history', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValue({ balance: 450, events: [
    { id: 'e2', delta: 27, reason: 'peer_response', label: 'Your answer was rated', createdAt: '2026-11-15T03:00:00.000Z' },
    { id: 'e1', delta: 10, reason: 'mission', label: 'Mission: 만나서 반갑습니다.', createdAt: '2026-11-14T03:00:00.000Z' },
  ] });
  mockApi.listRewards.mockResolvedValue(samples.rewards);
  render(<SessionProvider><Rewards /></SessionProvider>);
  expect(await screen.findByText('450')).toBeInTheDocument();
  expect(screen.getByText('Example rewards. Partners are not confirmed yet.')).toBeInTheDocument();
  const cafe = within(screen.getByRole('article', { name: 'Café drink coupon' }));
  expect(cafe.getByText('400 points')).toBeInTheDocument();
  expect(cafe.getByRole('button', { name: 'Coming soon' })).toBeDisabled();
  expect(cafe.getByText('You have enough points')).toBeInTheDocument();
  const album = within(screen.getByRole('article', { name: 'K-pop album voucher' }));
  expect(album.getByText('2,550 points to go')).toBeInTheDocument();
  expect(screen.getByText('+27')).toBeInTheDocument();
  expect(screen.getByText('Your answer was rated')).toBeInTheDocument();
});
it('invites a first mission when there is no history', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getPoints.mockResolvedValue({ balance: 0, events: [] });
  mockApi.listRewards.mockResolvedValue(samples.rewards);
  render(<SessionProvider><Rewards /></SessionProvider>);
  expect(await screen.findByText('No points yet. Your first mission is waiting.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to missions' })).toHaveAttribute('href', '/app');
});
