import { randomInt } from 'node:crypto';
import { getDb, type Db } from '../db';
import { SHARE_CODE_ALPHABET, type User } from '../contracts';
import { ApiError } from '../errors';
import { kstDayStartIso } from '../http';
import { SOCIAL_LIMITS, type Group, type GroupDetail, type LeaderboardPeriod } from '../social-contracts';
import { rankPeople } from './leaderboard';

type Row = { id: string; code: string; name: string; owner_id: string; created_at: Date | string; member_count: number };
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const select = `select g.id, g.code, g.name, g.owner_id, g.created_at,
  (select count(*)::int from hanlog.group_members m where m.group_id = g.id) as member_count from hanlog.groups g`;
const present = (row: Row, viewerId: string): Group => ({
  id: row.id, code: row.code, name: row.name, memberCount: row.member_count, isOwner: row.owner_id === viewerId, createdAt: new Date(row.created_at).toISOString(),
});
const newCode = () => Array.from({ length: 6 }, () => SHARE_CODE_ALPHABET[randomInt(SHARE_CODE_ALPHABET.length)]).join('');
async function membershipCount(db: Db, userId: string): Promise<number> {
  return (await db.query<{ count: number }>('select count(*)::int as count from hanlog.group_members where user_id = $1', [userId]))[0].count;
}

export async function createGroup(owner: User, name: string): Promise<Group> {
  return (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [owner.id]);
    const [{ count }] = await db.query<{ count: number }>('select count(*)::int as count from hanlog.groups where owner_id = $1 and created_at >= $2', [owner.id, kstDayStartIso()]);
    if (count >= SOCIAL_LIMITS.groupsCreatedPerDay) throw new ApiError('daily_limit');
    if (await membershipCount(db, owner.id) >= SOCIAL_LIMITS.groupsPerUser) throw new ApiError('conflict');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      if ((await db.query('select 1 from hanlog.groups where code = $1', [code])).length) continue;
      const [{ id }] = await db.query<{ id: string }>('insert into hanlog.groups (code, name, owner_id) values ($1,$2,$3) returning id', [code, name, owner.id]);
      await db.query('insert into hanlog.group_members (group_id, user_id) values ($1,$2)', [id, owner.id]);
      return present((await db.query<Row>(`${select} where g.id = $1`, [id]))[0], owner.id);
    }
    throw new ApiError('service_unavailable');
  });
}

export async function joinGroup(user: User, code: string): Promise<Group> {
  return (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [user.id]);
    const [group] = await db.query<{ id: string }>('select id from hanlog.groups where code = $1 for update', [code]);
    if (!group) throw new ApiError('not_found');
    const member = (await db.query('select 1 from hanlog.group_members where group_id = $1 and user_id = $2', [group.id, user.id])).length > 0;
    if (!member) {
      const [{ count }] = await db.query<{ count: number }>('select count(*)::int as count from hanlog.group_members where group_id = $1', [group.id]);
      if (count >= SOCIAL_LIMITS.membersPerGroup || await membershipCount(db, user.id) >= SOCIAL_LIMITS.groupsPerUser) throw new ApiError('conflict');
      await db.query('insert into hanlog.group_members (group_id, user_id) values ($1,$2)', [group.id, user.id]);
    }
    return present((await db.query<Row>(`${select} where g.id = $1`, [group.id]))[0], user.id);
  });
}

export async function listMyGroups(userId: string): Promise<Group[]> {
  const rows = await (await getDb()).query<Row>(`${select} join hanlog.group_members me on me.group_id = g.id and me.user_id = $1
    order by me.joined_at desc, g.id`, [userId]);
  return rows.map(row => present(row, userId));
}

export async function getGroupDetail(groupId: string, viewerId: string, period: LeaderboardPeriod): Promise<GroupDetail> {
  if (!isUuid(groupId)) throw new ApiError('not_found');
  const db = await getDb();
  const [row] = await db.query<Row>(`${select} where g.id = $1 and exists(select 1 from hanlog.group_members m where m.group_id = g.id and m.user_id = $2)`, [groupId, viewerId]);
  if (!row) throw new ApiError('not_found');
  const members = await rankPeople(db, { period, viewerId, groupId, limit: SOCIAL_LIMITS.membersPerGroup });
  return { group: present(row, viewerId), period, members };
}

/** Members leave; when the owner leaves, the group closes for everyone. */
export async function leaveGroup(groupId: string, user: User): Promise<void> {
  if (!isUuid(groupId)) throw new ApiError('not_found');
  await (await getDb()).tx(async db => {
    const [group] = await db.query<{ owner_id: string }>(`select g.owner_id from hanlog.groups g where g.id = $1
      and exists(select 1 from hanlog.group_members m where m.group_id = g.id and m.user_id = $2) for update`, [groupId, user.id]);
    if (!group) throw new ApiError('not_found');
    if (group.owner_id === user.id) await db.query('delete from hanlog.groups where id = $1', [groupId]);
    else await db.query('delete from hanlog.group_members where group_id = $1 and user_id = $2', [groupId, user.id]);
  });
}
