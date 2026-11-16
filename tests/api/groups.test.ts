import { expect, it } from 'vitest';
import { GET as myGroups, POST as createGroup } from '@/app/api/groups/route';
import { POST as joinGroup } from '@/app/api/groups/join/route';
import { DELETE as leaveGroup, GET as groupDetail } from '@/app/api/groups/[id]/route';
import { PUT as visibility } from '@/app/api/leaderboard/visibility/route';
import { getDb } from '@/lib/db';
import { GroupDetailSchema, GroupListSchema, GroupSchema, type Group } from '@/lib/social-contracts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call } from './_helpers';

useTestDb();
async function create(cookie: string, name = 'Sogang Wednesday') {
  const res = await call(createGroup, makeRequest('POST', '/api/groups', { cookie, json: { name } }));
  expect(res.status).toBe(201);
  return GroupSchema.parse((await res.json()).group);
}
const join = (cookie: string, code: string) => call(joinGroup, makeRequest('POST', '/api/groups/join', { cookie, json: { code } }));
async function detail(cookie: string, group: Group, period = 'all') {
  const res = await call(groupDetail, makeRequest('GET', `/api/groups/${group.id}?period=${period}`, { cookie }), { id: group.id });
  return { status: res.status, body: res.status === 200 ? GroupDetailSchema.parse(await res.json()) : null };
}
async function award(userId: string, delta: number) {
  await (await getDb()).query("insert into hanlog.point_events (user_id, delta, reason, ref_id, label) values ($1,$2,'mission','test','Test')", [userId, delta]);
}

it('creates a group with a join code and lists it for its owner', async () => {
  const owner = await createTestUser('learner', 'Owner');
  const group = await create(owner.cookie);
  expect(group).toMatchObject({ name: 'Sogang Wednesday', memberCount: 1, isOwner: true });
  expect(group.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  const list = GroupListSchema.parse(await (await call(myGroups, makeRequest('GET', '/api/groups', { cookie: owner.cookie }))).json());
  expect(list.groups.map(item => item.id)).toEqual([group.id]);
});

it('lets people join by code and compares every member, including those hidden from public leaderboards', async () => {
  const owner = await createTestUser('learner', 'Owner'); const friend = await createTestUser('korean', 'Friend'); const quiet = await createTestUser('learner', 'Quiet');
  const outsider = await createTestUser('learner', 'Outsider');
  const group = await create(owner.cookie);
  expect((await detail(outsider.cookie, group)).status).toBe(404);
  const joined = await join(friend.cookie, group.code.toLowerCase());
  expect(joined.status).toBe(200);
  expect(GroupSchema.parse((await joined.json()).group)).toMatchObject({ id: group.id, memberCount: 2, isOwner: false });
  expect((await join(friend.cookie, group.code)).status).toBe(200);
  expect((await join(quiet.cookie, group.code)).status).toBe(200);
  await call(visibility, makeRequest('PUT', '/api/leaderboard/visibility', { cookie: quiet.cookie, json: { visible: false } }));
  await award(friend.user.id, 30); await award(owner.user.id, 10); await award(outsider.user.id, 99);
  const { body } = await detail(owner.cookie, group);
  expect(body!.group.memberCount).toBe(3);
  expect(body!.members.map(member => [member.rank, member.nickname, member.points, member.isMe])).toEqual([[1, 'Friend', 30, false], [2, 'Owner', 10, true], [3, 'Quiet', 0, false]]);
  expect((await detail(quiet.cookie, group, 'today')).body!.period).toBe('today');
});

it('rejects unknown codes, unfriendly names, and full groups', async () => {
  const owner = await createTestUser();
  expect((await join(owner.cookie, 'ZZZZZZ')).status).toBe(404);
  expect((await join(owner.cookie, 'bad')).status).toBe(400);
  expect((await call(createGroup, makeRequest('POST', '/api/groups', { cookie: owner.cookie, json: { name: 'x' } }))).status).toBe(400);
  expect((await call(createGroup, makeRequest('POST', '/api/groups', { cookie: owner.cookie, json: { name: 'www.spam.example' } }))).status).toBe(422);
  const group = await create(owner.cookie);
  const db = await getDb();
  for (let i = 0; i < 49; i++) {
    const member = await createTestUser('learner', `Member ${i}`);
    await db.query('insert into hanlog.group_members (group_id, user_id) values ($1,$2)', [group.id, member.user.id]);
  }
  const late = await createTestUser();
  const full = await join(late.cookie, group.code);
  expect(full.status).toBe(409);
  for (let i = 0; i < 4; i++) await create(owner.cookie, `Group ${i}`);
  const limited = await call(createGroup, makeRequest('POST', '/api/groups', { cookie: owner.cookie, json: { name: 'One too many' } }));
  expect(limited.status).toBe(429);
});

it('lets members leave and owners close the group', async () => {
  const owner = await createTestUser(); const member = await createTestUser();
  const group = await create(owner.cookie);
  await join(member.cookie, group.code);
  expect((await call(leaveGroup, makeRequest('DELETE', `/api/groups/${group.id}`, { cookie: member.cookie }), { id: group.id })).status).toBe(204);
  expect((await detail(member.cookie, group)).status).toBe(404);
  expect((await detail(owner.cookie, group)).body!.group.memberCount).toBe(1);
  await join(member.cookie, group.code);
  expect((await call(leaveGroup, makeRequest('DELETE', `/api/groups/${group.id}`, { cookie: owner.cookie }), { id: group.id })).status).toBe(204);
  expect((await detail(member.cookie, group)).status).toBe(404);
  expect((await join(member.cookie, group.code)).status).toBe(404);
});

it('includes posts, likes and groups in the profile data export', async () => {
  const { GET: exportData } = await import('@/app/api/account/export/route');
  const owner = await createTestUser('learner', 'Owner');
  const group = await create(owner.cookie, 'Export check');
  const db = await getDb();
  const [{ id: postId }] = await db.query<{ id: string }>("insert into hanlog.posts (author_id, korean, meaning_en, width, height) values ($1,'집콕','Staying in',10,10) returning id", [owner.user.id]);
  await db.query('insert into hanlog.post_likes (post_id, user_id) values ($1,$2)', [postId, owner.user.id]);
  const data = await (await call(exportData, makeRequest('GET', '/api/account/export', { cookie: owner.cookie }))).json();
  expect(data.posts).toEqual([expect.objectContaining({ id: postId, korean: '집콕', photoAvailable: false })]);
  expect(data.likedPosts).toEqual([expect.objectContaining({ id: postId })]);
  expect(data.groups).toEqual([expect.objectContaining({ id: group.id, name: 'Export check', isOwner: true })]);
  expect(JSON.stringify(data)).not.toContain('posts/');
});

it('limits wrong join codes so codes cannot be guessed', async () => {
  const owner = await createTestUser(); const guesser = await createTestUser();
  const group = await create(owner.cookie);
  const wrong = group.code === '222222' ? '333333' : '222222';
  for (let i = 0; i < 10; i++) expect((await join(guesser.cookie, wrong)).status).toBe(404);
  const blocked = await join(guesser.cookie, group.code);
  expect(blocked.status).toBe(429);
  expect((await blocked.json()).error.code).toBe('daily_limit');
  expect((await join(owner.cookie, group.code)).status).toBe(200);
});
