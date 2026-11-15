import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api-client', async original => ({ ...(await original<typeof import('@/lib/api-client')>()), api: (await import('./_helpers')).mockApi }));
import { DemoPreparation } from '@/components/demo/DemoPreparation';
import { fakeDeps, fakeStream } from './_fakes';
import { mockApi, resetMocks } from './_helpers';

beforeEach(resetMocks);
const expectNoApiCalls = () => {
  for (const value of Object.values(mockApi)) if (typeof value === 'function') expect(value).not.toHaveBeenCalled();
};

it('checks a microphone with local playback and manual confirmation, without any API calls', async () => {
  const deps = fakeDeps();
  render(<DemoPreparation onClose={vi.fn()} deps={deps} />);
  expect(screen.getByText(/stays in this browser/)).toHaveTextContent(/not uploaded or sent to AI/);
  expect(screen.queryByRole('radio', { name: 'Video' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mic sounds good' })).not.toBeInTheDocument();
  expect(deps.streams).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Stop' });
  deps.clock.advance(3000);
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(await screen.findByLabelText('Recording preview')).toHaveAttribute('controls');
  expect(deps.streams[0].stopped()).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Mic sounds good' }));
  expect(screen.getByRole('status')).toHaveTextContent('You confirmed that playback sounds clear.');
  expect(screen.queryByLabelText('Recording preview')).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  await userEvent.click(screen.getByRole('button', { name: 'Check microphone again' }));
  expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
  expectNoApiCalls();
});

it('releases a late microphone permission response after preparation closes', async () => {
  const stream = fakeStream(); let resolve!: (stream: MediaStream) => void;
  const deps = fakeDeps({ getUserMedia: () => new Promise(value => { resolve = value; }) });
  const onClose = vi.fn();
  const { unmount } = render(<DemoPreparation onClose={onClose} deps={deps} />);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  await screen.findByRole('button', { name: 'Cancel microphone request' });
  await userEvent.click(screen.getByRole('button', { name: 'Close preparation' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => { resolve(stream); });
  expect(stream.stopped()).toBe(true);
  expectNoApiCalls();
});

it('keeps a denied microphone check retryable without claiming readiness', async () => {
  const deps = fakeDeps({ getUserMedia: async () => { throw new DOMException('no', 'NotAllowedError'); } });
  render(<DemoPreparation onClose={vi.fn()} deps={deps} />);
  await userEvent.click(screen.getByRole('button', { name: 'Record' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access is off.');
  expect(screen.queryByRole('button', { name: 'Mic sounds good' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Record' })).toBeEnabled();
  expectNoApiCalls();
});
