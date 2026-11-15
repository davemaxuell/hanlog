import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import { ChallengeDetailPage } from '@/components/challenge/ChallengeDetailPage';
import { MediaPlayer } from '@/components/challenge/MediaPlayer';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';
import { fakeDeps } from './_fakes';
beforeEach(resetMocks);
const pending = samples.response;                      // status 'pending'
const rated = samples.ratedResponse;                   // status 'rated', feedback null

it('lets a learner answer with voice or video', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForLearner, viewerRole: 'visitor', myResponse: null });
  mockApi.submitResponse.mockResolvedValue(pending);
  nav.params = { id: samples.challenge.id };
  const deps = fakeDeps();
  render(<SessionProvider><ChallengeDetailPage recorderDeps={deps} /></SessionProvider>);
  expect(await screen.findByText(samples.challenge.korean)).toHaveAttribute('lang', 'ko');
  expect(screen.getByRole('radio', { name: 'Video' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(4000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Send answer' }));
  expect(mockApi.submitResponse).toHaveBeenCalledWith(samples.challenge.id, expect.objectContaining({ kind: 'audio', durationMs: 4000 }));
  expect(await screen.findByText(`Sent. ${samples.challenge.author.nickname} will rate it.`)).toBeInTheDocument();
});
it('shows a responder the rating and takes feedback once', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForLearner, viewerRole: 'responder', myResponse: rated });
  mockApi.giveFeedback.mockResolvedValue({ ...rated, feedback: { helpfulness: 5, comment: 'Thanks!', givenAt: '2026-11-15T04:00:00.000Z' } });
  nav.params = { id: samples.challenge.id };
  render(<SessionProvider><ChallengeDetailPage /></SessionProvider>);
  expect(await screen.findByRole('img', { name: `Pronunciation: ${rated.rating!.pronunciation} out of 5` })).toBeInTheDocument();
  expect(screen.getByText(rated.rating!.comment)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
  await userEvent.type(screen.getByLabelText('Comment (optional)'), 'Thanks!');
  await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
  expect(mockApi.giveFeedback).toHaveBeenCalledWith(rated.id, { helpfulness: 5, comment: 'Thanks!' });
  expect(await screen.findByText('Thanks. Your feedback was sent.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send feedback' })).toBeNull();
});
it('lets the author play and rate each waiting answer', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForAuthor, viewerRole: 'author', responses: [pending] });
  mockApi.mediaUrl.response.mockReturnValue(`/api/responses/${pending.id}/media`);
  mockApi.fetchMediaBlobUrl.mockResolvedValue('blob:one');
  mockApi.rateResponse.mockResolvedValue({ ...rated, id: pending.id });
  nav.params = { id: samples.challenge.id };
  render(<SessionProvider><ChallengeDetailPage /></SessionProvider>);
  const card = within(await screen.findByRole('article', { name: `Answer from ${pending.responder.nickname}` }));
  const submit = card.getByRole('button', { name: 'Send rating' });
  expect(submit).toBeDisabled();
  await userEvent.click(card.getByRole('button', { name: 'Play' }));
  expect(mockApi.fetchMediaBlobUrl).toHaveBeenCalledWith(`/api/responses/${pending.id}/media`);
  await userEvent.click(within(card.getByRole('radiogroup', { name: 'Pronunciation' })).getByRole('radio', { name: '4 stars' }));
  await userEvent.click(within(card.getByRole('radiogroup', { name: 'Naturalness' })).getByRole('radio', { name: '5 stars' }));
  await userEvent.click(submit);
  expect(mockApi.rateResponse).toHaveBeenCalledWith(pending.id, { pronunciation: 4, naturalness: 5, comment: '' });
  expect(await card.findByText('Rated. Thank you.')).toBeInTheDocument();
});
it('reports an answer after a confirmation', async () => {
  mockApi.getSession.mockResolvedValue(samples.koreanUser);
  mockApi.getChallenge.mockResolvedValue({ ...samples.challengeDetailForAuthor, viewerRole: 'rater', responses: [pending] });
  mockApi.reportResponse.mockResolvedValue(undefined);
  nav.params = { id: samples.challenge.id };
  render(<SessionProvider><ChallengeDetailPage /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Report' }));
  await userEvent.click(screen.getByRole('button', { name: 'Yes, report it' }));
  expect(mockApi.reportResponse).toHaveBeenCalledWith(pending.id);
  await waitFor(() => expect(screen.queryByRole('article', { name: `Answer from ${pending.responder.nickname}` })).toBeNull());
});
it('revokes the playback URL when the player goes away', async () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mockApi.fetchMediaBlobUrl.mockResolvedValue('blob:two');
  const { unmount } = render(<MediaPlayer url="/api/responses/r1/media" kind="audio" label="Answer" />);
  await userEvent.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:two'));
  unmount();
  expect(revoke).toHaveBeenCalledWith('blob:two');
});
it('says so when a recording has expired', async () => {
  mockApi.fetchMediaBlobUrl.mockRejectedValue(new ApiClientError('not_found', 404, 'x'));
  render(<MediaPlayer url="/api/responses/r1/media" kind="audio" label="Answer" />);
  await userEvent.click(screen.getByRole('button', { name: 'Play' }));
  expect(await screen.findByText('This recording is no longer available.')).toBeInTheDocument();
});
