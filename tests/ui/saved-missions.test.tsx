import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
const progressMock = vi.hoisted(() => ({ summary: vi.fn(), saveMission: vi.fn() }));
vi.mock('@/lib/progress-client', () => ({ progressApi: progressMock }));
vi.mock('next/navigation', async () => (await import('./_helpers')).navigationMock);
vi.mock('@/lib/api-client', async original => ({ ...await original<typeof import('@/lib/api-client')>(), api: (await import('./_helpers')).mockApi }));
import MissionsPage from '@/app/app/missions/page';
import { ApiClientError } from '@/lib/api-client';
import { SessionProvider } from '@/lib/ui/session-context';
import { samples } from '../fixtures/api/samples';
import { mockApi, resetMocks, nav } from './_helpers';
import { progressSummary } from './_progress-fakes';

beforeEach(() => { resetMocks(); progressMock.summary.mockReset().mockResolvedValue(progressSummary()); progressMock.saveMission.mockReset(); mockApi.getSession.mockResolvedValue(samples.user); mockApi.listMissions.mockResolvedValue({ missions: samples.missions, today: [] }); nav.pathname = '/app/missions'; });
it('changes saved state only after success and keeps the filter useful after retry', async () => {
  progressMock.saveMission.mockRejectedValueOnce(new ApiClientError('internal', 500, 'x')).mockResolvedValueOnce(undefined);
  render(<SessionProvider><MissionsPage /></SessionProvider>);
  const label = `Save expression: ${samples.missions[0].meaningEn}`;
  const save = await screen.findByRole('button', { name: label });
  await userEvent.click(save);
  expect(await screen.findByText('We couldn’t save that expression. Please try again.')).toBeInTheDocument();
  expect(save).toHaveAttribute('aria-pressed', 'false');
  await userEvent.click(save);
  expect(await screen.findByRole('button', { name: `Remove saved expression: ${samples.missions[0].meaningEn}` })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Saved expressions' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});
it('expires the session when saving rejects an old cookie', async () => {
  progressMock.saveMission.mockRejectedValue(new ApiClientError('unauthenticated', 401, 'x'));
  render(<SessionProvider><MissionsPage /></SessionProvider>);
  await userEvent.click(await screen.findByRole('button', { name: `Save expression: ${samples.missions[0].meaningEn}` }));
  expect(nav.replace).toHaveBeenCalledWith('/app/onboarding?next=%2Fapp%2Fmissions');
});
