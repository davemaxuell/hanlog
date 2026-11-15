import { expect, it } from 'vitest';
import { getDb } from '@/lib/db';
import { SYSTEM_USER_ID } from '@/lib/contracts';
import { countUsersSince, createUser, deleteUserCascade, getUser, updateUser } from '@/lib/repo/users';
import { useTestDb } from '../../helpers/api';

useTestDb();

it('retains budget reservations after profile deletion', async () => {
  const user = await createUser({ nickname: 'Aisha', role: 'learner', ipHash: 'h1' });
  const db = await getDb();
  await db.query('insert into hanlog.scoring_calls (user_id, ip_hash) values ($1, $2)', [user.id, 'h1']);
  await deleteUserCascade(user.id);
  expect((await db.query<{ n: number }>('select count(*)::int as n from hanlog.scoring_calls where ip_hash = $1', ['h1']))[0].n).toBe(1);
  expect((await db.query<{ user_id: string }>('select user_id from hanlog.scoring_calls where ip_hash = $1', ['h1']))[0].user_id).toBe(SYSTEM_USER_ID);
});

it('creates, reads, and updates', async () => {
  const u = await createUser({ nickname: 'Aisha', role: 'learner', ipHash: 'h1' });
  expect(u).toMatchObject({ nickname: 'Aisha', role: 'learner' });
  expect(u.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  expect(await getUser(u.id)).toEqual(u);
  expect((await updateUser(u.id, { role: 'korean' })).role).toBe('korean');
  expect(await getUser('not-a-uuid')).toBeNull();
  await expect(updateUser('3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11', { nickname: 'x' })).rejects.toMatchObject({ code: 'not_found' });
});
it('counts users per address since a time', async () => {
  await createUser({ nickname: 'a1', role: 'learner', ipHash: 'h1' });
  await createUser({ nickname: 'a2', role: 'learner', ipHash: 'h1' });
  await createUser({ nickname: 'b1', role: 'learner', ipHash: 'h2' });
  expect(await countUsersSince('h1', '2000-01-01T00:00:00.000Z')).toBe(2);
  expect(await countUsersSince('h1', '2999-01-01T00:00:00.000Z')).toBe(0);
});
it('deletes a user with everything they own and reports media paths', async () => {
  const db = await getDb();
  const author = await createUser({ nickname: 'Minji', role: 'korean', ipHash: 'h' });
  const learner = await createUser({ nickname: 'Aisha', role: 'learner', ipHash: 'h' });
  const [{ id: challengeId }] = await db.query<{ id: string }>(
    `insert into hanlog.challenges (code, author_id, korean, meaning_en, reference_path, reference_mime)
     values ('ABC234', $1, '대박', 'wow', 'references/c1.webm', 'audio/webm') returning id`, [author.id]);
  await db.query(
    `insert into hanlog.challenge_responses (challenge_id, responder_id, media_path, media_kind, media_mime, duration_ms)
     values ($1, $2, 'responses/r1.webm', 'audio', 'audio/webm', 3000)`, [challengeId, learner.id]);
  const paths = await deleteUserCascade(author.id);
  expect(paths.sort()).toEqual(['references/c1.webm', 'responses/r1.webm']);
  expect(await getUser(author.id)).toBeNull();
  expect((await db.query<{ n: number }>('select count(*)::int as n from hanlog.challenge_responses'))[0].n).toBe(0);
  expect(await getUser(learner.id)).not.toBeNull();
});
