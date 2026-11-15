import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
const progressMock = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('@/lib/progress-client', () => ({ progressApi: progressMock }));
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
import { AttemptJournal } from '@/components/mission/AttemptJournal';
import { ApiClientError } from '@/lib/api-client';
import { samples } from '../fixtures/api/samples';

beforeEach(() => progressMock.history.mockReset());
it('opens stored feedback and preserves loaded history when an earlier page fails', async () => {
  const attempt = { ...samples.attemptResult.attempt, pointsAwarded: 0 };
  progressMock.history.mockResolvedValueOnce({ attempts: [attempt], nextCursor: 'older' }).mockRejectedValueOnce(new ApiClientError('internal', 500, 'x')).mockResolvedValueOnce({ attempts: [attempt, { ...attempt, id: '00000000-0000-4000-8000-000000000099', createdAt: '2026-11-14T01:00:00.000Z' }], nextCursor: null });
  render(<AttemptJournal missions={samples.missions} />);
  const phrase = await screen.findByText(samples.missions[0].korean, { selector: 'strong span' });
  await userEvent.click(phrase.closest('summary')!);
  expect(screen.getByText(attempt.score.nextTip)).toBeVisible();
  expect(screen.getByText(attempt.score.heard, { selector: 'p' })).toHaveAttribute('lang', 'ko');
  expect(screen.getByText(/No points this time/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Load earlier attempts' }));
  expect(await screen.findByText(/Your current history is still here/)).toBeInTheDocument();
  expect(screen.getByText(attempt.score.nextTip)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Load earlier attempts' }));
  expect((await screen.findAllByText(samples.missions[0].korean, { selector: 'strong span' }))).toHaveLength(2);
  expect(progressMock.history).toHaveBeenLastCalledWith({ cursor: 'older', missionId: undefined, limit: 10 });
  expect(screen.queryByRole('button', { name: 'Load earlier attempts' })).not.toBeInTheDocument();
});
it('shows a focused empty state for a mission without inventing progress', async () => {
  progressMock.history.mockResolvedValue({ attempts: [], nextCursor: null });
  render(<AttemptJournal missions={samples.missions} missionId={samples.missions[0].id} />);
  expect(await screen.findByText('This expression is waiting for your voice.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Choose a practice →' })).toHaveAttribute('href', `/app/missions/${samples.missions[0].id}`);
});
