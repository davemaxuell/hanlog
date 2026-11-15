import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import Home from '@/app/app/page';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, resetMocks } from './_helpers';
beforeEach(resetMocks);
it("shows today's three missions and all missions grouped by level", async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.listMissions.mockResolvedValue({ missions: samples.missions, today: samples.missions.slice(0, 3).map((m) => m.id) });
  render(<SessionProvider><Home /></SessionProvider>);
  expect(await screen.findByText(`안녕하세요, ${samples.user.nickname}`)).toBeInTheDocument();
  const today = within(await screen.findByRole('region', { name: "Today's missions" }));
  expect(today.getAllByRole('link')).toHaveLength(3);
  expect(screen.getByRole('heading', { name: 'Level 1' })).toBeInTheDocument();
  const first = samples.missions[0];
  expect(screen.getAllByRole('link', { name: new RegExp(first.meaningEn) })[0]).toHaveAttribute('href', `/app/missions/${first.id}`);
  expect(screen.queryByText('Post a challenge')).toBeNull();
});
it('puts the peer block first for a Korean speaker', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.listMissions.mockResolvedValue({ missions: samples.missions, today: [] });
  mockApi.listChallenges.mockResolvedValue([{ ...samples.challenge, viewer: { responded: false, pendingToRate: 2 } }]);
  render(<SessionProvider><Home /></SessionProvider>);
  expect(await screen.findByText('2 answers waiting for your rating')).toBeInTheDocument();
  expect(mockApi.listChallenges).toHaveBeenCalledWith('to-rate');
  expect(screen.getByRole('link', { name: 'Post a challenge' })).toHaveAttribute('href', '/app/challenges/new');
});
it('offers a retry when loading fails', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.listMissions.mockRejectedValueOnce(new ApiClientError('internal', 500, 'x')).mockResolvedValueOnce({ missions: samples.missions, today: [] });
  render(<SessionProvider><Home /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Level 1' })).toBeInTheDocument();
});
