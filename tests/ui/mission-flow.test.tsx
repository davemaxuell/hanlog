import { act, render, screen, waitFor } from '@testing-library/react';
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
  expect(screen.getByRole('radio', { name: 'Voice' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Video' })).toBeVisible();
  expect(screen.getByLabelText('Upload a voice file').closest('details')).toBeNull();
  expect(screen.queryByText(mission.romanization)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Show romanization' }));
  expect(screen.getByText(mission.romanization)).toBeInTheDocument();
});

it('offers a concise presentation with accessible context, romanization, and reference audio', async () => {
  render(<MissionFlow mission={{ ...mission, referenceAudio: '/audio/missions/example.mp3' }} presentation headingLevel={2} convert={convert} deps={fakeDeps()} />);
  expect(screen.getByRole('heading', { level: 2, name: mission.korean })).toHaveAttribute('lang', 'ko');
  expect(screen.getByText(mission.meaningEn)).toBeVisible();
  expect(screen.getByText(mission.promptEn)).toBeVisible();
  expect(screen.queryByRole('radio', { name: 'Video' })).not.toBeInTheDocument();
  const context = screen.getByText('Where to say it').closest('details');
  expect(context).not.toBeNull();
  expect(context).not.toHaveAttribute('open');
  expect(screen.getByText(mission.situationEn)).not.toBeVisible();
  await userEvent.click(screen.getByText('Where to say it'));
  expect(context).toHaveAttribute('open');
  expect(screen.getByText(mission.situationEn)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Show romanization' }));
  expect(screen.getByText(mission.romanization)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Listen' })).toBeVisible();
  expect(screen.getByText('AI voice')).toBeVisible();
  expect(screen.getByText('Up to 15 seconds. Your solo recording is used for scoring, then discarded.')).toBeVisible();
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

it('reports conversion and scoring as active and ignores scoring responses after unmount', async () => {
  let converted!: (value: Uint8Array) => void; let scored!: (value: AttemptResult) => void;
  const convert = vi.fn(() => new Promise<Uint8Array>(value => { converted = value; }));
  mockApi.submitAttempt.mockReturnValue(new Promise(value => { scored = value; }));
  const activity = vi.fn(); const onScored = vi.fn(); const deps = fakeDeps();
  const { unmount } = render(<MissionFlow mission={mission} convert={convert} deps={deps} onScored={onScored} onActivityChange={activity} />);
  await recordAndSubmit(deps);
  expect(await screen.findByRole('button', { name: 'Preparing recording…' })).toBeDisabled();
  expect(activity).toHaveBeenLastCalledWith(true);
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
  await act(async () => { converted(toneWav(1000)); });
  await screen.findByRole('button', { name: 'Listening…' });
  expect(activity).toHaveBeenLastCalledWith(true);
  expect(mockApi.submitAttempt).toHaveBeenCalledTimes(1);
  unmount();
  expect(activity).toHaveBeenLastCalledWith(false);
  await act(async () => { scored(samples.attemptResult); });
  expect(onScored).not.toHaveBeenCalled();
  expect(mockApi.submitAttempt).toHaveBeenCalledTimes(1);
});

it('does not submit when conversion finishes after unmount', async () => {
  let converted!: (value: Uint8Array) => void;
  const deps = fakeDeps();
  const { unmount } = render(<MissionFlow mission={mission} convert={() => new Promise(value => { converted = value; })} deps={deps} />);
  await recordAndSubmit(deps);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Preparing recording…' })).toBeDisabled());
  unmount();
  await act(async () => { converted(toneWav(1000)); });
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});

it('guards a presentation upload until it is discarded', async () => {
  const activity = vi.fn();
  render(<MissionFlow mission={mission} presentation onActivityChange={activity} convert={convert} deps={fakeDeps()} />);
  await userEvent.click(screen.getByText('Use a saved voice file'));
  await userEvent.upload(screen.getByLabelText('Upload a voice file'), new File(['voice'], 'voice.wav', { type: 'audio/wav' }));
  expect(activity).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Get my score' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Retake' }));
  expect(activity).toHaveBeenLastCalledWith(false);
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});

it('checks submission eligibility after conversion and never submits when it is denied', async () => {
  let converted!: (wav: Uint8Array) => void;
  const beforeSubmit = vi.fn().mockResolvedValue(false); const deps = fakeDeps();
  render(<MissionFlow mission={mission} convert={() => new Promise(resolve => { converted = resolve; })} beforeSubmit={beforeSubmit} deps={deps} />);
  await recordAndSubmit(deps);
  expect(beforeSubmit).not.toHaveBeenCalled();
  await act(async () => { converted(toneWav(1000)); });
  expect(beforeSubmit).toHaveBeenCalledTimes(1);
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});

it('does not submit after unmount while a profile check is pending', async () => {
  let checked!: (allowed: boolean) => void;
  const beforeSubmit = vi.fn(() => new Promise<boolean>(resolve => { checked = resolve; })); const deps = fakeDeps();
  const { unmount } = render(<MissionFlow mission={mission} convert={convert} beforeSubmit={beforeSubmit} deps={deps} />);
  await recordAndSubmit(deps);
  await waitFor(() => expect(beforeSubmit).toHaveBeenCalledTimes(1));
  unmount();
  await act(async () => { checked(true); });
  expect(mockApi.submitAttempt).not.toHaveBeenCalled();
});
