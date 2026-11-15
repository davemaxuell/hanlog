import { afterEach, expect, it, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { finishScoringCall, reserveScoringCall } from '@/lib/limits';
import { useTestDb } from '../../helpers/api';

useTestDb();
afterEach(() => vi.unstubAllEnvs());
const u = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

it('counts down the user allowance and then refuses', async () => {
  vi.stubEnv('USER_DAILY_ATTEMPTS', '2');
  expect((await reserveScoringCall({ userId: u(10), ipHash: 'a' })).leftToday).toBe(1);
  expect((await reserveScoringCall({ userId: u(10), ipHash: 'a' })).leftToday).toBe(0);
  await expect(reserveScoringCall({ userId: u(10), ipHash: 'a' })).rejects.toMatchObject({ code: 'daily_limit' });
  expect((await reserveScoringCall({ userId: u(11), ipHash: 'b' })).leftToday).toBe(1);
});
it('caps an address across users, so a cleared cookie does not reset it', async () => {
  vi.stubEnv('IP_DAILY_ATTEMPTS', '2');
  await reserveScoringCall({ userId: u(10), ipHash: 'same' });
  await reserveScoringCall({ userId: u(11), ipHash: 'same' });
  await expect(reserveScoringCall({ userId: u(12), ipHash: 'same' })).rejects.toMatchObject({ code: 'daily_limit' });
});
it('does not apply the address cap to an unknown address', async () => {
  vi.stubEnv('IP_DAILY_ATTEMPTS', '1');
  await reserveScoringCall({ userId: u(10), ipHash: 'unknown' });
  await expect(reserveScoringCall({ userId: u(11), ipHash: 'unknown' })).resolves.toBeTruthy();
});
it('stops everyone at the global cap', async () => {
  vi.stubEnv('GLOBAL_DAILY_ATTEMPTS', '2');
  await reserveScoringCall({ userId: u(10), ipHash: 'a' });
  await reserveScoringCall({ userId: u(11), ipHash: 'b' });
  await expect(reserveScoringCall({ userId: u(12), ipHash: 'c' })).rejects.toMatchObject({ code: 'budget_exhausted' });
});
it('resets at Korea-time midnight and counts failed calls', async () => {
  vi.stubEnv('USER_DAILY_ATTEMPTS', '1');
  const r = await reserveScoringCall({ userId: u(10), ipHash: 'a', now: new Date('2026-11-15T14:00:00Z') }); // 23:00 on the 15th in Korea
  await finishScoringCall(r.id, 'failed');
  await expect(reserveScoringCall({ userId: u(10), ipHash: 'a', now: new Date('2026-11-15T14:30:00Z') })).rejects.toMatchObject({ code: 'daily_limit' });
  await expect(reserveScoringCall({ userId: u(10), ipHash: 'a', now: new Date('2026-11-15T15:30:00Z') })).resolves.toBeTruthy(); // 00:30 on the 16th
  const rows = await (await getDb()).query<{ outcome: string }>('select outcome from hanlog.scoring_calls order by id');
  expect(rows.map((x) => x.outcome)).toEqual(['failed', 'pending']);
});
