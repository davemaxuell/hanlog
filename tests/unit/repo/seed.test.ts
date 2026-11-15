import { expect, it } from 'vitest';
import { SYSTEM_USER_ID } from '@/lib/contracts';
import { getSampleChallenges } from '@/lib/content';
import { getDb } from '@/lib/db';
import { ensureSeed } from '@/lib/repo/seed';
import { getUser } from '@/lib/repo/users';
import { useTestDb } from '../../helpers/api';

useTestDb();

it('seeds the system user and sample challenges once', async () => {
  const db = await getDb();                       // createTestDb already seeded
  expect(await getUser(SYSTEM_USER_ID)).toMatchObject({ nickname: 'HanLog 팀', role: 'korean' });
  const count = async () => (await db.query<{ n: number }>('select count(*)::int as n from hanlog.challenges where is_sample'))[0].n;
  expect(await count()).toBe(getSampleChallenges().length);
  await ensureSeed(db);
  expect(await count()).toBe(getSampleChallenges().length);
});
