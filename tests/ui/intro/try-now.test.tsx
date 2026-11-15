import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('../_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('../_helpers')).mockApi }));

import { TryNow } from '@/components/intro/TryNow';
import { ApiClientError } from '@/lib/api-client';
import { samples } from '../../fixtures/api/samples';
import { toneWav } from '../../helpers/audio';
import { fakeDeps } from '../_fakes';
import { mockApi, resetMocks } from '../_helpers';

beforeEach(resetMocks);
const mission = samples.missions.find((m) => m.id === 'cafe-iced-americano')!;
const consent = () => screen.getByRole('checkbox', { name: /I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days\. I am 14 or older\./ });
const mount = (deps = fakeDeps()) => { render(<TryNow mission={mission} convert={async () => toneWav(1000)} deps={deps} />); return deps; };

it('does nothing until consent is given', () => {
  const deps = mount();
  expect(screen.getByRole('heading', { name: 'Try it now' })).toBeInTheDocument();
  expect(screen.getByText(mission.korean)).toHaveAttribute('lang', 'ko');
  expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
  expect(mockApi.getSession).not.toHaveBeenCalled();
  expect(mockApi.createSession).not.toHaveBeenCalled();
  expect(deps.streams).toHaveLength(0);
});
it('creates a guest learner on consent and then scores for real', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  mockApi.submitAttempt.mockResolvedValue(samples.attemptResult);
  const deps = mount();
  await userEvent.click(consent());
  await waitFor(() => expect(mockApi.createSession).toHaveBeenCalledTimes(1));
  expect(mockApi.createSession.mock.calls[0][0]).toEqual({ nickname: expect.stringMatching(/^Guest \d{4}$/), role: 'learner' });
  await userEvent.click(await screen.findByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
  expect(await screen.findByRole('meter', { name: 'Pronunciation' })).toBeInTheDocument();
  expect(mockApi.submitAttempt).toHaveBeenCalledWith('cafe-iced-americano', expect.any(Uint8Array));
  expect(screen.getByRole('link', { name: 'Keep going in the app' })).toHaveAttribute('href', '/app');
});
it('reuses an existing session instead of creating a guest', async () => {
  mockApi.getSession.mockResolvedValue(samples.user);
  mount();
  await userEvent.click(consent());
  expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
  expect(mockApi.createSession).not.toHaveBeenCalled();
});
it('explains a refused session and lets the visitor retry', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockRejectedValueOnce(new ApiClientError('daily_limit', 429, 'x')).mockResolvedValueOnce(samples.user);
  mount();
  await userEvent.click(consent());
  expect(await screen.findByRole('alert')).toHaveTextContent("You have reached today’s limit for this action. Try again tomorrow.");
  expect(screen.queryByRole('button', { name: 'Record' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
});
it('does not create two guests when the box is toggled quickly', async () => {
  mockApi.getSession.mockResolvedValue(null);
  mockApi.createSession.mockResolvedValue(samples.user);
  mount();
  await userEvent.click(consent());
  await userEvent.click(consent());
  await userEvent.click(consent());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument());
  expect(mockApi.createSession).toHaveBeenCalledTimes(1);
});
