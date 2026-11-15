import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async (original) => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import { MissionFlow } from '@/components/mission/MissionFlow';
import { ApiClientError } from '@/lib/api-client';
import type { AttemptResult } from '@/lib/contracts';
import { ConvertError } from '@/lib/audio/to-wav';
import { samples } from '../fixtures/api/samples';
import { toneWav } from '../helpers/audio';
import { mockApi, resetMocks } from './_helpers';
import { fakeDeps } from './_fakes';
beforeEach(resetMocks);
const mission = samples.missions.find((m) => m.mode === 'repeat')!;
const convert = vi.fn(async () => toneWav(1000));
const recordAndSubmit = async (deps: ReturnType<typeof fakeDeps>) => {
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
};

it('shows the mission with romanization hidden until asked', async () => {
  render(<MissionFlow mission={mission} convert={convert} deps={fakeDeps()} />);
  expect(screen.getByText(mission.korean)).toHaveAttribute('lang', 'ko');
  expect(screen.getByText(mission.meaningEn)).toBeInTheDocument();
  expect(screen.getByText('Where to say it')).toBeInTheDocument();
  expect(screen.getByText(mission.situationEn)).toBeInTheDocument();
  expect(screen.queryByText(mission.romanization)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Show romanization' }));
  expect(screen.getByText(mission.romanization)).toBeInTheDocument();
});
it('records, converts, submits once, and shows the score', async () => {
  let release!: (value: AttemptResult) => void;
  mockApi.submitAttempt.mockReturnValue(new Promise((resolve) => { release = resolve; }));
  const onScored = vi.fn();
  const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={convert} deps={deps} onScored={onScored} />);
  await recordAndSubmit(deps);
  const waiting = await screen.findByRole('button', { name: 'Listening…' });
  await userEvent.click(waiting);                                   // a second tap during the wait
  expect(mockApi.submitAttempt).toHaveBeenCalledTimes(1);
  expect(mockApi.submitAttempt).toHaveBeenCalledWith(mission.id, expect.any(Uint8Array));
  release(samples.attemptResult);
  expect(await screen.findByRole('meter', { name: 'Pronunciation' })).toBeInTheDocument();
  expect(onScored).toHaveBeenCalledWith(samples.attemptResult);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
});
it('keeps the recording and explains when nothing was heard', async () => {
  mockApi.submitAttempt.mockRejectedValue(new ApiClientError('no_speech', 422, 'x'));
  const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={convert} deps={deps} />);
  await recordAndSubmit(deps);
  expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't hear any Korean. Move closer to the mic and try again.");
  expect(screen.getByRole('button', { name: 'Get my score' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
});
it('explains a recording the browser cannot convert, without calling the server', async () => {
  const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={async () => { throw new ConvertError('undecodable'); }} deps={deps} />);
  await recordAndSubmit(deps);
  expect(await screen.findByRole('alert')).toHaveTextContent("That recording didn't work. Please record again.");
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});
it('plays the reference clip, labelled as an AI voice, only when there is one', () => {
  const { rerender } = render(<MissionFlow mission={{ ...mission, referenceAudio: null }} convert={convert} deps={fakeDeps()} />);
  expect(screen.queryByRole('button', { name: /Listen/ })).toBeNull();
  rerender(<MissionFlow mission={{ ...mission, referenceAudio: '/audio/missions/x.mp3' }} convert={convert} deps={fakeDeps()} />);
  expect(screen.getByRole('button', { name: /Listen/ })).toBeInTheDocument();
  expect(screen.getByText('AI voice')).toBeInTheDocument();
});
