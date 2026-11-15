import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
import { useApi } from '@/lib/ui/use-api';

it('hides previous request data as soon as the resource changes and ignores its late result', async () => {
  let finish!: (value: string) => void;
  const load = vi.fn().mockResolvedValueOnce('first private conversation').mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce('third conversation');
  const view = renderHook(({ id }) => useApi(() => load(id), [id]), { initialProps: { id: 'first' } });
  await waitFor(() => expect(view.result.current.data).toBe('first private conversation'));
  view.rerender({ id: 'second' });
  expect(view.result.current.data).toBeNull();
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  view.rerender({ id: 'third' });
  await waitFor(() => expect(view.result.current.data).toBe('third conversation'));
  await act(async () => finish('second conversation'));
  expect(view.result.current.data).toBe('third conversation');
});
