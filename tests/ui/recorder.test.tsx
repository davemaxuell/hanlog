import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Recorder } from '@/components/recorder/Recorder';
import { fakeDeps, fakeStream, FakeMediaRecorder } from './_fakes';

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
  expect(screen.getByRole('button', { name: 'Listening…' }).closest('.hl-capture-panel')).toHaveAttribute('data-state', 'busy');
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

it('keeps a compact saved voice upload available through an explicit disclosure', async () => {
  const onSubmit = vi.fn();
  render(<Recorder modes={['audio']} allowUpload compact submitLabel="Get my score" onSubmit={onSubmit} deps={fakeDeps()} />);
  const disclosure = screen.getByText('Use a saved voice file').closest('details');
  expect(disclosure).not.toHaveAttribute('open');
  expect(screen.getByLabelText('Upload a voice file')).not.toBeVisible();
  await userEvent.click(screen.getByText('Use a saved voice file'));
  expect(disclosure).toHaveAttribute('open');
  expect(screen.getByLabelText('Upload a voice file')).toBeVisible();
  const file = new File(['voice'], 'voice.wav', { type: 'audio/wav' });
  await userEvent.upload(screen.getByLabelText('Upload a voice file'), file);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText('Files up to 4 MB. Only the first 20 seconds are scored.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Get my score' }));
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ blob: file, kind: 'audio' }));
});

it('recovers when a submission callback throws synchronously', async () => {
  const deps = fakeDeps();
  render(<Recorder modes={['audio']} submitLabel="Get my score" onSubmit={() => { throw new Error('submission failed'); }} deps={deps} />);
  await record(deps);
  await userEvent.click(await screen.findByRole('button', { name: 'Get my score' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('We could not complete that. Please try again.');
  expect(screen.getByRole('button', { name: 'Get my score' })).toBeEnabled();
});
it('notifies the owner when a selected recording is discarded', async () => {
  const deps = fakeDeps(); const onReset = vi.fn();
  render(<Recorder modes={['audio']} submitLabel="Use this recording" onSubmit={vi.fn()} onReset={onReset} deps={deps} />);
  await record(deps);
  await userEvent.click(await screen.findByRole('button', { name: 'Use this recording' }));
  await userEvent.click(screen.getByRole('button', { name: 'Retake' }));
  expect(onReset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
});
it('locks retake while an asynchronous submit is pending even without a busy prop', async () => {
  const deps = fakeDeps();
  render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={() => new Promise(() => {})} deps={deps} />);
  await record(deps);
  await userEvent.click(await screen.findByRole('button', { name: 'Send answer' }));
  expect(screen.getByRole('button', { name: 'Retake' })).toBeDisabled();
});
it('retries a network failure using the same recording', async () => {
  const deps = fakeDeps(); const onSubmit = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={onSubmit} deps={deps} />);
  await record(deps);
  await userEvent.click(await screen.findByRole('button', { name: 'Send answer' }));
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: 'Send answer' }));
  expect(onSubmit).toHaveBeenCalledTimes(2);
  expect(onSubmit.mock.calls[1][0].blob).toBe(onSubmit.mock.calls[0][0].blob);
});

it('reports permission, recording, and stopping as active until the recording is ready', async () => {
  let resolve!: (stream: MediaStream) => void; let finish!: () => void;
  const activity = vi.fn();
  class DelayedRecorder extends FakeMediaRecorder {
    stop() { this.state = 'inactive'; finish = () => { this.ondataavailable?.({ data: new Blob(['recorded']) } as BlobEvent); this.onstop?.(); }; }
  }
  const deps = fakeDeps({ getUserMedia: () => new Promise(value => { resolve = value; }), createRecorder: (stream, options) => new DelayedRecorder(stream, options) as unknown as MediaRecorder });
  const { unmount } = render(<Recorder modes={['audio']} submitLabel="Send answer" onSubmit={vi.fn()} onActivityChange={activity} deps={deps} />);
  const panel = screen.getByRole('button', { name: 'Record' }).closest('.hl-capture-panel');
  expect(panel).toHaveAttribute('data-state', 'idle');
  expect(activity).toHaveBeenLastCalledWith(false);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  expect(panel).toHaveAttribute('data-state', 'requesting');
  expect(panel?.querySelector('.hl-recording-dot')).toBeNull();
  expect(activity).toHaveBeenLastCalledWith(true);
  await act(async () => { resolve(fakeStream()); });
  await screen.findByRole('button', { name: 'Stop' });
  expect(panel).toHaveAttribute('data-state', 'recording');
  expect(panel?.querySelector('.hl-recording-dot')).toHaveAttribute('aria-hidden', 'true');
  const level = screen.getByRole('meter', { name: 'Microphone level' });
  await waitFor(() => expect(level).toHaveAttribute('aria-valuenow', '40'));
  expect(level.querySelector('span')).toHaveStyle({ transform: 'scaleX(0.4)' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await screen.findByRole('button', { name: 'Finishing recording…' });
  expect(panel).toHaveAttribute('data-state', 'stopping');
  expect(panel?.querySelector('.hl-recording-dot')).toBeNull();
  expect(activity).toHaveBeenLastCalledWith(true);
  await act(async () => { finish(); });
  expect(panel).toHaveAttribute('data-state', 'ready');
  expect(activity).toHaveBeenLastCalledWith(false);
  unmount();
  expect(activity).toHaveBeenLastCalledWith(false);
});

it('can guard a ready recording while leaving Retake enabled to discard and unlock it', async () => {
  const deps = fakeDeps(); const activity = vi.fn(); const onSubmit = vi.fn();
  render(<Recorder modes={['audio']} submitLabel="Get my score" guardPendingRecording onSubmit={onSubmit} onActivityChange={activity} deps={deps} />);
  await record(deps);
  await screen.findByRole('button', { name: 'Get my score' });
  expect(activity).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Retake' })).toBeEnabled();
  expect(screen.getByText('Choose Get my score, or Retake to discard this clip before changing scenes.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Retake' }));
  expect(activity).toHaveBeenLastCalledWith(false);
  expect(screen.queryByLabelText('Recording preview')).not.toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});
