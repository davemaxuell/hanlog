import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
const social = vi.hoisted(() => ({
  leaderboard: vi.fn(), setLeaderboardVisibility: vi.fn(), feed: vi.fn(), sharePost: vi.fn(), setLike: vi.fn(), reportPost: vi.fn(), deletePost: vi.fn(),
  groups: vi.fn(), createGroup: vi.fn(), joinGroup: vi.fn(), group: vi.fn(), leaveGroup: vi.fn(),
}));
vi.mock('@/lib/social-client', () => ({ socialApi: social }));
import Ranks from '@/app/app/leaderboard/page';
import Feed from '@/app/app/feed/page';
import Groups from '@/app/app/groups/page';
import { SessionProvider } from '@/lib/ui/session-context';
import type { Post, RankedPerson } from '@/lib/social-contracts';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';

const person = (rank: number, nickname: string, points: number, isMe = false): RankedPerson => ({
  rank, userId: `00000000-0000-4000-8000-00000000000${rank}${nickname.length}`, nickname, role: 'learner', points, practised: 3, averageScore: 82, isMe,
});
const post: Post = {
  id: '11111111-1111-4111-8111-111111111111', author: { id: '22222222-2222-4222-8222-222222222222', nickname: 'Joon', role: 'korean' },
  korean: '이 영화 완전 꿀잼이야.', meaningEn: 'This movie is so much fun.', note: 'After the late show', width: 480, height: 360,
  imageUrl: '/api/posts/11111111-1111-4111-8111-111111111111/image', likes: 2, likedByMe: false, mine: false, createdAt: new Date().toISOString(),
};
beforeEach(() => {
  resetMocks();
  for (const fn of Object.values(social)) fn.mockReset();
  mockApi.getSession.mockResolvedValue(samples.user);
});

it('shows the live leaderboard with the viewer’s standing and switches period', async () => {
  social.leaderboard.mockImplementation(async (period: string) => ({ period, entries: [person(1, 'Mina', 40), person(2, 'You', 25, true)], me: { rank: 2, points: 25, visible: true } }));
  render(<SessionProvider><Ranks /></SessionProvider>);
  expect(await screen.findByText("You're #2 today")).toBeInTheDocument();
  const list = within(screen.getByRole('list', { name: "Today's leaderboard" }));
  expect(list.getAllByRole('listitem').map(item => item.textContent)).toEqual([expect.stringContaining('Mina'), expect.stringContaining('You')]);
  expect(list.getAllByText('Rank', { exact: false })).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'All time' }));
  await waitFor(() => expect(social.leaderboard).toHaveBeenLastCalledWith('all'));
  expect(await screen.findByText("You're #2 overall")).toBeInTheDocument();
  expect(within(screen.getByRole('navigation', { name: 'Community' })).getByRole('link', { name: 'Ranks' })).toHaveAttribute('href', '/app/leaderboard');
});

it('shows Korean moments with likes, and hides a post its viewer reports', async () => {
  social.feed.mockResolvedValue({ posts: [post], nextCursor: null });
  social.setLike.mockResolvedValue({ likes: 3, likedByMe: true });
  social.reportPost.mockResolvedValue(undefined);
  render(<SessionProvider><Feed /></SessionProvider>);
  const card = within(await screen.findByRole('article', { name: '이 영화 완전 꿀잼이야.' }));
  expect(card.getByRole('heading', { level: 2 })).toHaveAttribute('lang', 'ko');
  expect(card.getByRole('img')).toHaveAttribute('src', post.imageUrl);
  await userEvent.click(card.getByRole('button', { name: 'Like. 2 likes' }));
  expect(social.setLike).toHaveBeenCalledWith(post.id, true);
  expect(await card.findByRole('button', { name: 'Like. 3 likes' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(card.getByText('Report'));
  await userEvent.click(card.getByRole('button', { name: 'Inappropriate' }));
  expect(social.reportPost).toHaveBeenCalledWith(post.id, 'inappropriate');
  expect(await screen.findByText(/You won't see that post again/)).toBeInTheDocument();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Share a moment/ })).toHaveAttribute('href', '/app/feed/new');
});

it('joins a group from an invite link and checks codes before sending', async () => {
  nav.search = new URLSearchParams('join=abc234');
  social.groups.mockResolvedValue({ groups: [] });
  social.joinGroup.mockResolvedValue({ group: { id: '33333333-3333-4333-8333-333333333333', code: 'ABC234', name: 'Club', memberCount: 2, isOwner: false, createdAt: new Date().toISOString() } });
  render(<SessionProvider><Groups /></SessionProvider>);
  expect(await screen.findByText(/You were invited to a group/)).toBeInTheDocument();
  const code = screen.getByLabelText('Group code');
  expect(code).toHaveValue('ABC234');
  await userEvent.clear(code); await userEvent.type(code, 'IO0');
  await userEvent.click(screen.getByRole('button', { name: 'Join group' }));
  expect(await screen.findByText('Enter the six-character group code.')).toBeInTheDocument();
  expect(social.joinGroup).not.toHaveBeenCalled();
  await userEvent.clear(code); await userEvent.type(code, 'abc234');
  await userEvent.click(screen.getByRole('button', { name: 'Join group' }));
  expect(social.joinGroup).toHaveBeenCalledWith('ABC234');
  await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/app/groups/33333333-3333-4333-8333-333333333333'));
});
