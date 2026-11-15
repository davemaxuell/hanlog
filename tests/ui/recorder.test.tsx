import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Recorder } from '@/components/recorder/Recorder';
import { fakeDeps } from './_fakes';

const record = async (deps: ReturnType<typeof fakeDeps>, ms = 3000) => {
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(ms);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
};

it('records, previews, and submits once', async () => {
  const deps = fakeDeps();
  const onSubmit = vi.fn();
  render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} deps={deps} />);
  await record(deps);
  const submit = await screen.findByRole('button', { name: 'Get my score' });
  expect(screen.getByRole('button', { name: 'Retake' })).toBeInTheDocument();
  await userEvent.dblClick(submit);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ kind: 'audio', durationMs: 3000 });
});
it('locks the submit button while the parent is busy', async () => {
  const deps = fakeDeps();
  const onSubmit = vi.fn();
  const { rerender } = render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} deps={deps} />);
  await record(deps);
  await screen.findByRole('button', { name: 'Get my score' });
  rerender(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} deps={deps} busy busyLabel="Listening…" />);
  expect(screen.getByRole('button', { name: 'Listening…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retake' })).toBeDisabled();
});
it('offers Voice and Video only when both modes are allowed', () => {
  const { rerender } = render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={vi.fn()} deps={fakeDeps()} />);
  expect(screen.queryByRole('radio', { name: 'Video' })).toBeNull();
  rerender(<Recorder modes={['audio', 'video']} submitLabel="Send answer" onSubmit={vi.fn()} deps={fakeDeps()} />);
  expect(screen.getByRole('radio', { name: 'Voice' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Video' })).toBeInTheDocument();
});
it('gives a way forward when the microphone is unavailable', async () => {
  const onSubmit = vi.fn();
  render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={onSubmit} allowUpload deps={fakeDeps({ getUserMedia: async () => { throw new DOMException('no', 'NotAllowedError'); } })} />);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access is off.');
  const file = new File([new Uint8Array(100)], 'voice.m4a', { type: 'audio/mp4' });
  await userEvent.upload(screen.getByLabelText('Upload a voice file'), file);
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ blob: file, kind: 'audio', durationMs: 0 })));
});
it('hides the upload control unless allowed', () => {
  render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={vi.fn()} deps={fakeDeps()} />);
  expect(screen.queryByLabelText('Upload a voice file')).toBeNull();
});
