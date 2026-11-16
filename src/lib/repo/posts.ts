import { randomUUID } from 'node:crypto';
import { getDb, type Db } from '../db';
import type { Role, User } from '../contracts';
import type { ReportReason } from '../community-contracts';
import { ApiError } from '../errors';
import { kstDayStartIso } from '../http';
import { getMediaStore } from '../media';
import { finishMediaRemoval, lockMediaPaths, queuePostMediaRemoval } from '../media/pending';
import { POINT_LABELS, POSTS_REWARDED_PER_DAY, POST_AWARD } from '../points/rules';
import { SOCIAL_LIMITS, type Post, type PostPage } from '../social-contracts';
import { encodeCommunityCursor, type CommunityCursor } from './community-pagination';
import { addPointEvent } from './points';
import { lockSessionUser } from './users';
import { REPORTS_PER_DAY } from './community';

type Row = {
  id: string; author_id: string; nickname: string; role: Role; korean: string; meaning_en: string; note: string;
  width: number; height: number; created_at: Date | string; cursor_at: string; likes: number; liked: boolean;
};
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
// $1 is always the viewer. A reporter stops seeing a post at once; two reports hide it for everyone.
const visible = `p.status = 'visible' and p.image_path is not null
  and not exists(select 1 from hanlog.post_reports r where r.post_id = p.id and r.reporter_id = $1)`;
const select = `select p.id, p.author_id, u.nickname, u.role, p.korean, p.meaning_en, p.note, p.width, p.height, p.created_at,
  to_char(p.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_at,
  (select count(*)::int from hanlog.post_likes l where l.post_id = p.id) as likes,
  exists(select 1 from hanlog.post_likes l where l.post_id = p.id and l.user_id = $1) as liked
  from hanlog.posts p join hanlog.users u on u.id = p.author_id`;
function present(row: Row, viewerId: string): Post {
  return {
    id: row.id, author: { id: row.author_id, nickname: row.nickname, role: row.role },
    korean: row.korean, meaningEn: row.meaning_en, note: row.note, width: row.width, height: row.height,
    imageUrl: `/api/posts/${row.id}/image`, likes: row.likes, likedByMe: row.liked, mine: row.author_id === viewerId,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function createPost(input: {
  author: User; expectedVersion?: number; korean: string; meaningEn: string; note: string; jpeg: Uint8Array; width: number; height: number;
}): Promise<{ post: Post; pointsAwarded: number }> {
  const id = randomUUID();
  const path = `posts/${id}.jpg`;
  await queuePostMediaRemoval(path, input.author.id);
  try {
    return await (await getDb()).tx(async db => {
      await db.query('select pg_advisory_xact_lock(hashtext($1))', [input.author.id]);
      await lockSessionUser(db, input.author.id, input.expectedVersion);
      const since = kstDayStartIso();
      const [{ posts, rewarded }] = await db.query<{ posts: number; rewarded: number }>(`select
        (select count(*)::int from hanlog.posts where author_id = $1 and created_at >= $2) as posts,
        (select count(*)::int from hanlog.point_events where user_id = $1 and reason = 'post' and created_at >= $2) as rewarded`, [input.author.id, since]);
      if (posts >= SOCIAL_LIMITS.postsPerDay) throw new ApiError('daily_limit');
      await lockMediaPaths(db, [path]);
      await db.query(`insert into hanlog.posts (id, author_id, korean, meaning_en, note, image_path, width, height)
        values ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, input.author.id, input.korean, input.meaningEn, input.note, path, input.width, input.height]);
      await getMediaStore().put(path, input.jpeg, 'image/jpeg');
      await db.query('delete from hanlog.pending_media_deletions where path = $1', [path]);
      // Deleted posts keep their point event, so deleting and re-posting cannot earn more than the daily few.
      const pointsAwarded = rewarded < POSTS_REWARDED_PER_DAY ? POST_AWARD : 0;
      await addPointEvent(db, { userId: input.author.id, delta: pointsAwarded, reason: 'post', refId: id, label: POINT_LABELS.post });
      const [row] = await db.query<Row>(`${select} where p.id = $2`, [input.author.id, id]);
      return { post: present(row, input.author.id), pointsAwarded };
    });
  } catch (error) {
    try { await finishMediaRemoval(path); } catch { /* The queued path is retried by cleanup. */ }
    if (error instanceof ApiError) throw error;
    throw new ApiError('service_unavailable');
  }
}

export async function listPosts(viewerId: string, options: { limit: number; cursor?: CommunityCursor | null }): Promise<PostPage> {
  const values: unknown[] = [viewerId, options.limit + 1];
  let where = visible;
  if (options.cursor) { values.push(options.cursor.at, options.cursor.id); where += ' and (p.created_at, p.id) < ($3::timestamptz, $4::uuid)'; }
  const rows = await (await getDb()).query<Row>(`${select} where ${where} order by p.created_at desc, p.id desc limit $2`, values);
  const page = rows.slice(0, options.limit);
  const last = page.at(-1);
  return { posts: page.map(row => present(row, viewerId)), nextCursor: rows.length > options.limit && last ? encodeCommunityCursor(last.cursor_at, last.id) : null };
}

export async function getPostImagePath(postId: string, viewerId: string): Promise<string | null> {
  if (!isUuid(postId)) return null;
  const [row] = await (await getDb()).query<{ image_path: string }>(`select p.image_path from hanlog.posts p where p.id = $2 and ${visible}`, [viewerId, postId]);
  return row?.image_path ?? null;
}

async function findPost(db: Db, postId: string, viewerId: string): Promise<{ id: string; author_id: string; image_path: string | null } | null> {
  if (!isUuid(postId)) return null;
  const [row] = await db.query<{ id: string; author_id: string; image_path: string | null }>(`select p.id, p.author_id, p.image_path from hanlog.posts p where p.id = $2 and ${visible}`, [viewerId, postId]);
  return row ?? null;
}

export async function deletePost(postId: string, user: User): Promise<void> {
  if (!isUuid(postId)) throw new ApiError('not_found');
  const path = await (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [user.id]);
    const [post] = await db.query<{ author_id: string; image_path: string | null }>('select author_id, image_path from hanlog.posts where id = $1 for update', [postId]);
    if (!post) throw new ApiError('not_found');
    if (post.author_id !== user.id) throw new ApiError('forbidden');
    if (post.image_path) {
      await lockMediaPaths(db, [post.image_path]);
      await queuePostMediaRemoval(post.image_path, user.id, db);
    }
    await db.query('delete from hanlog.posts where id = $1', [postId]);
    return post.image_path;
  });
  if (path) {
    try { await finishMediaRemoval(path); } catch { /* Cleanup retries the queued, unreferenced photo. */ }
  }
}

export async function setPostLike(postId: string, user: User, liked: boolean): Promise<{ likes: number; likedByMe: boolean }> {
  return (await getDb()).tx(async db => {
    if (!await findPost(db, postId, user.id)) throw new ApiError('not_found');
    if (liked) await db.query('insert into hanlog.post_likes (post_id, user_id) values ($1,$2) on conflict do nothing', [postId, user.id]);
    else await db.query('delete from hanlog.post_likes where post_id = $1 and user_id = $2', [postId, user.id]);
    const [row] = await db.query<{ likes: number }>('select count(*)::int as likes from hanlog.post_likes where post_id = $1', [postId]);
    return { likes: row.likes, likedByMe: liked };
  });
}

export async function reportPost(postId: string, user: User, reason: ReportReason): Promise<void> {
  await (await getDb()).tx(async db => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [user.id]);
    const [already] = await db.query('select id from hanlog.post_reports where post_id = $1 and reporter_id = $2', [postId, user.id]);
    if (already) return;
    const post = await findPost(db, postId, user.id);
    if (!post) throw new ApiError('not_found');
    if (post.author_id === user.id) throw new ApiError('forbidden');
    const [{ count }] = await db.query<{ count: number }>('select count(*)::int as count from hanlog.post_reports where reporter_id = $1 and created_at >= $2', [user.id, kstDayStartIso()]);
    if (count >= REPORTS_PER_DAY) throw new ApiError('daily_limit');
    await db.query('insert into hanlog.post_reports (reporter_id, post_id, reason) values ($1,$2,$3)', [user.id, postId, reason]);
    const [{ reports }] = await db.query<{ reports: number }>("select count(*)::int as reports from hanlog.post_reports where post_id = $1 and status <> 'dismissed'", [postId]);
    if (reports >= SOCIAL_LIMITS.postReportsToHide) await db.query("update hanlog.posts set status = 'hidden' where id = $1", [postId]);
  });
}
