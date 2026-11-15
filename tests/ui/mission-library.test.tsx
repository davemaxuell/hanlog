import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MissionLibrary } from '@/components/mission/MissionLibrary';
import { samples } from '../fixtures/api/samples';

const missions = samples.missions.slice(0, 3).map((mission, index) => ({ ...mission, bestOverall: index === 0 ? 88 : index === 1 ? 42 : null, pointsEarned: index === 0 ? 10 : 0 }));
beforeEach(() => window.history.replaceState(null, '', '/app/missions'));

it('searches Korean and English and combines practice status with saved expressions', async () => {
  render(<MissionLibrary missions={missions} savedMissionIds={[missions[1].id]} onToggleSaved={vi.fn()} />);
  const user = userEvent.setup();
  const results = () => within(screen.getByRole('list', { name: 'Mission results' }));
  expect(results().getAllByRole('listitem')).toHaveLength(3);
  await user.type(screen.getByRole('searchbox', { name: 'Search missions' }), missions[0].korean);
  expect(results().getAllByRole('listitem')).toHaveLength(1);
  await user.clear(screen.getByRole('searchbox', { name: 'Search missions' }));
  await user.selectOptions(screen.getByLabelText('Practice status'), 'review');
  expect(results().getAllByRole('listitem')).toHaveLength(1);
  expect(results().getByText(missions[1].korean)).toHaveAttribute('lang', 'ko');
  await user.click(screen.getByRole('button', { name: 'Saved expressions' }));
  expect(results().getAllByRole('listitem')).toHaveLength(1);
  await user.type(screen.getByRole('searchbox', { name: 'Search missions' }), 'no matching phrase');
  expect(screen.getByText('No expressions match yet.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(results().getAllByRole('listitem')).toHaveLength(3);
});

it('keeps a zero-point attempt practised and sends the exact save action', async () => {
  const onToggleSaved = vi.fn();
  render(<MissionLibrary missions={missions} savedMissionIds={[missions[1].id]} onToggleSaved={onToggleSaved} />);
  await userEvent.selectOptions(screen.getByLabelText('Practice status'), 'practised');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: `Remove saved expression: ${missions[1].meaningEn}` }));
  expect(onToggleSaved).toHaveBeenCalledWith(missions[1].id, false);
});
it('restores filters when returning from a mission and when browser history changes', async () => {
  const props = { missions, savedMissionIds: [missions[1].id], onToggleSaved: vi.fn() };
  const view = render(<MissionLibrary {...props} />);
  await userEvent.selectOptions(screen.getByLabelText('Practice status'), 'review');
  expect(new URLSearchParams(window.location.search).get('status')).toBe('review');
  view.unmount();
  render(<MissionLibrary {...props} />);
  expect(screen.getByLabelText('Practice status')).toHaveValue('review');
  act(() => { window.history.replaceState(null, '', '/app/missions?status=strong'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.getByLabelText('Practice status')).toHaveValue('strong');
  expect(within(screen.getByRole('list', { name: 'Mission results' })).getAllByRole('listitem')).toHaveLength(1);
});
