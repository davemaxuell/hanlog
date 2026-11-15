import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
vi.mock('@/lib/account-client', () => ({ accountApi: { status: vi.fn().mockResolvedValue({ recoveryEnabled: false, recoveryUpdatedAt: null }) } }));
import Me from '@/app/app/me/page';
import ShareLink from '@/app/c/[code]/page';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, nav, resetMocks } from './_helpers';
beforeEach(() => {
  resetMocks();
  // jsdom has no native modal methods; real focus behavior is covered by Playwright.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
it('edits the nickname and switches role', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.updateSession.mockImplementation(async (patch: object) => ({ ...samples.user, ...patch }));
  render(<SessionProvider><Me /></SessionProvider>);
  const input = await screen.findByLabelText('Nickname');
  await userEvent.clear(input);
  await userEvent.type(input, 'Aisha K');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(mockApi.updateSession).toHaveBeenCalledWith({ nickname: 'Aisha K' });
  expect(await screen.findByText('Saved.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: /I speak Korean/ }));
  expect(mockApi.updateSession).toHaveBeenLastCalledWith({ role: 'korean' });
});
it('deletes everything only after a second confirmation', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.deleteSession.mockResolvedValue(undefined);
  render(<SessionProvider><Me /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete my data' }));
  expect(mockApi.deleteSession).not.toHaveBeenCalled();
  expect(screen.getByText('This removes your nickname, scores, points, challenges, answers, and stored recordings. It cannot be undone.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
  expect(mockApi.deleteSession).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
});
it('follows a share code to the challenge, or says the link is not valid', async () => {
  mockApi.getChallenge.mockResolvedValueOnce(samples.challengeDetailForLearner);
  nav.params = { code: 'abc234' };
  const first = render(<ShareLink />);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(`/app/challenges/${samples.challenge.id}`));
  expect(mockApi.getChallenge).toHaveBeenCalledWith('abc234');
  first.unmount();
  mockApi.getChallenge.mockRejectedValueOnce(new ApiClientError('not_found', 404, 'x'));
  render(<ShareLink />);
  expect(await screen.findByText('This challenge link is not valid.')).toBeInTheDocument();
});
it('sends a visitor with a share link through onboarding and back', async () => {
  mockApi.getChallenge.mockRejectedValueOnce(new ApiClientError('unauthenticated', 401, 'x'));
  nav.params = { code: 'ABC234' };
  render(<ShareLink />);
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fc%2FABC234'));
});
it('keeps a failed deletion open for retry and can cancel without deleting', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.deleteSession.mockRejectedValueOnce(new ApiClientError('internal', 503, 'x')).mockResolvedValueOnce(undefined);
  render(<SessionProvider><Me /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete my data' }));
  await userEvent.click(screen.getByRole('button', { name: 'Keep my data' }));
  expect(mockApi.deleteSession).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(nav.replace).not.toHaveBeenCalledWith('/');
  await userEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }));
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
});
it('returns an expired profile update to onboarding instead of failing silently', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mockApi.updateSession.mockRejectedValue(new ApiClientError('unauthenticated', 401, 'expired'));
  nav.pathname = '/app/me';
  render(<SessionProvider><Me /></SessionProvider>);
  await userEvent.click(await screen.findByRole('radio', { name: /I speak Korean/ }));
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fapp%2Fme'));
});
