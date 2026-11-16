import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { GET as feed, POST as createPost } from '@/app/api/posts/route';
import { DELETE as removePost } from '@/app/api/posts/[id]/route';
import { GET as image } from '@/app/api/posts/[id]/image/route';
import { PUT as like } from '@/app/api/posts/[id]/like/route';
import { POST as report } from '@/app/api/posts/[id]/report/route';
import { DELETE as deleteProfile } from '@/app/api/session/route';
import { getDb } from '@/lib/db';
import { cleanupExpiredMedia } from '@/lib/media/cleanup';
import { getBalance } from '@/lib/repo/points';
import { CreatedPostSchema, PostPageSchema, type Post } from '@/lib/social-contracts';
import { createTestUser, makeRequest, useTestDb } from '../helpers/api';
import { call, useMemoryMedia, webmBytes } from './_helpers';

useTestDb();
const media = useMemoryMedia();
const photo = new Uint8Array(readFileSync('tests/fixtures/media/photo.jpg'));
const jpeg = (bytes = photo) => new File([new Uint8Array(bytes)], 'moment.jpg', { type: 'image/jpeg' });
function share(cookie: string | undefined, fields: Record<string, string | File | null> = {}) {
  const form = new FormData();
  const values: Record<string, string | File | null> = { image: jpeg(), korean: '아이스 아메리카노 한 잔 주세요.', meaningEn: 'One iced Americano, please.', note: 'Ordered at the campus café', ...fields };
  for (const [key, value] of Object.entries(values)) if (value !== null) form.set(key, value);
  return call(createPost, makeRequest('POST', '/api/posts', { cookie, form }));
}
async function shared(cookie: string, fields: Record<string, string | File | null> = {}) {
  const res = await share(cookie, fields);
  expect(res.status).toBe(201);
  return CreatedPostSchema.parse(await res.json());
}
async function listFeed(cookie: string, query = '') {
  const res = await call(feed, makeRequest('GET', `/api/posts${query}`, { cookie }));
  expect(res.status).toBe(200);
  return PostPageSchema.parse(await res.json());
}
const ctx = (post: Post) => ({ id: post.id });

it('shares a Korean moment with a metadata-free photo and rewards the first posts of the day', async () => {
  const mina = await createTestUser('learner', 'Mina'); const joon = await createTestUser('korean', 'Joon');
  const created = await shared(mina.cookie);
  expect(created.pointsAwarded).toBe(5);
  expect(created.post).toMatchObject({ korean: '아이스 아메리카노 한 잔 주세요.', meaningEn: 'One iced Americano, please.', note: 'Ordered at the campus café', width: 480, height: 360, likes: 0, likedByMe: false, mine: true, author: { nickname: 'Mina', role: 'learner' } });
  expect(created.post.imageUrl).toBe(`/api/posts/${created.post.id}/image`);
  expect(await getBalance(await getDb(), mina.user.id)).toBe(5);

  const seen = await listFeed(joon.cookie);
  expect(seen.posts.map(post => [post.korean, post.mine])).toEqual([['아이스 아메리카노 한 잔 주세요.', false]]);
  const res = await call(image, makeRequest('GET', created.post.imageUrl, { cookie: joon.cookie }), ctx(created.post));
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/jpeg');
  const served = Buffer.from(await res.arrayBuffer());
  expect(served.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  expect(served.includes(Buffer.from('HanLogTestCam'))).toBe(false);
  expect((await call(image, makeRequest('GET', created.post.imageUrl), ctx(created.post))).status).toBe(401);

  for (let i = 0; i < 2; i++) expect((await shared(mina.cookie)).pointsAwarded).toBe(5);
  for (let i = 0; i < 3; i++) expect((await shared(mina.cookie)).pointsAwarded).toBe(0);
  expect(await getBalance(await getDb(), mina.user.id)).toBe(15);
  const limited = await share(mina.cookie);
  expect(limited.status).toBe(429);
  expect((await limited.json()).error.code).toBe('daily_limit');
});

it('rejects posts without Korean, without a real JPEG, or with links', async () => {
  const user = await createTestUser();
  const code = async (res: Response) => [res.status, (await res.json()).error.code];
  expect(await code(await share(user.cookie, { korean: 'Just coffee' }))).toEqual([400, 'invalid_input']);
  expect(await code(await share(user.cookie, { meaningEn: '' }))).toEqual([400, 'invalid_input']);
  expect(await code(await share(user.cookie, { image: null }))).toEqual([400, 'invalid_input']);
  expect(await code(await share(user.cookie, { image: new File([new Uint8Array(webmBytes())], 'clip.jpg', { type: 'image/jpeg' }) }))).toEqual([415, 'media_invalid']);
  expect(await code(await share(user.cookie, { image: jpeg(photo.subarray(0, 300)) }))).toEqual([415, 'media_invalid']);
  expect(await code(await share(user.cookie, { image: new File([new Uint8Array(1_600_000)], 'big.jpg', { type: 'image/jpeg' }) }))).toEqual([413, 'audio_too_large']);
  expect(await code(await share(user.cookie, { note: 'More at https://example.com' }))).toEqual([422, 'content_rejected']);
  expect((await share(undefined)).status).toBe(401);
  expect(media.paths()).toEqual([]);
});

it('counts likes once per person and lets people take them back', async () => {
  const author = await createTestUser('learner', 'Author'); const fan = await createTestUser('learner', 'Fan'); const other = await createTestUser('korean', 'Other');
  const { post } = await shared(author.cookie);
  const toggle = async (cookie: string, liked: boolean) => (await call(like, makeRequest('PUT', `/api/posts/${post.id}/like`, { cookie, json: { liked } }), ctx(post))).json();
  expect(await toggle(fan.cookie, true)).toEqual({ likes: 1, likedByMe: true });
  expect(await toggle(fan.cookie, true)).toEqual({ likes: 1, likedByMe: true });
  expect(await toggle(other.cookie, true)).toEqual({ likes: 2, likedByMe: true });
  expect(await toggle(fan.cookie, false)).toEqual({ likes: 1, likedByMe: false });
  expect((await listFeed(other.cookie)).posts[0]).toMatchObject({ likes: 1, likedByMe: true });
});

it('hides a reported post from its reporter at once, and from everyone after two reports', async () => {
  const author = await createTestUser('learner', 'Author'); const first = await createTestUser(); const second = await createTestUser(); const bystander = await createTestUser();
  const { post } = await shared(author.cookie);
  const flag = (cookie: string) => call(report, makeRequest('POST', `/api/posts/${post.id}/report`, { cookie, json: { reason: 'inappropriate' } }), ctx(post));
  expect((await call(report, makeRequest('POST', `/api/posts/${post.id}/report`, { cookie: author.cookie, json: { reason: 'spam' } }), ctx(post))).status).toBe(403);
  expect((await flag(first.cookie)).status).toBe(204);
  expect((await listFeed(first.cookie)).posts).toEqual([]);
  expect((await listFeed(bystander.cookie)).posts).toHaveLength(1);
  expect((await flag(first.cookie)).status).toBe(204);
  expect((await flag(second.cookie)).status).toBe(204);
  expect((await listFeed(bystander.cookie)).posts).toEqual([]);
  expect((await call(image, makeRequest('GET', post.imageUrl, { cookie: bystander.cookie }), ctx(post))).status).toBe(404);
});

it('lets only the author delete a post, removing its photo', async () => {
  const author = await createTestUser(); const other = await createTestUser();
  const { post } = await shared(author.cookie);
  expect(media.paths()).toHaveLength(1);
  expect((await call(removePost, makeRequest('DELETE', `/api/posts/${post.id}`, { cookie: other.cookie }), ctx(post))).status).toBe(403);
  expect((await call(removePost, makeRequest('DELETE', `/api/posts/${post.id}`, { cookie: author.cookie }), ctx(post))).status).toBe(204);
  expect(media.paths()).toEqual([]);
  expect((await listFeed(other.cookie)).posts).toEqual([]);
});

it('pages through the feed newest first', async () => {
  const author = await createTestUser();
  for (const korean of ['하나', '둘', '셋']) await shared(author.cookie, { korean });
  const one = await listFeed(author.cookie, '?limit=2');
  expect(one.posts.map(post => post.korean)).toEqual(['셋', '둘']);
  const two = await listFeed(author.cookie, `?limit=2&cursor=${one.nextCursor}`);
  expect(two.posts.map(post => post.korean)).toEqual(['하나']);
  expect(two.nextCursor).toBeNull();
});

it('removes photos with the profile and after the retention period', async () => {
  const leaving = await createTestUser(); const staying = await createTestUser();
  await shared(leaving.cookie); const { post } = await shared(staying.cookie);
  expect(media.paths()).toHaveLength(2);
  expect((await call(deleteProfile, makeRequest('DELETE', '/api/session', { cookie: leaving.cookie }))).status).toBe(204);
  expect(media.paths()).toHaveLength(1);
  await (await getDb()).query("update hanlog.posts set created_at = now() - interval '15 days' where id = $1", [post.id]);
  expect(await cleanupExpiredMedia()).toBe(1);
  expect(media.paths()).toEqual([]);
  expect((await listFeed(staying.cookie)).posts).toEqual([]);
});
