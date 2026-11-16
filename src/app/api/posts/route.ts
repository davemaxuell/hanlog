import { ApiError } from '@/lib/errors';
import { LIMITS } from '@/lib/contracts';
import { json, readFormData, route } from '@/lib/http';
import { inspectJpeg } from '@/lib/media/jpeg';
import { assertImageAllowed } from '@/lib/moderation';
import { communityPageInput } from '@/lib/repo/community-pagination';
import { createPost, listPosts } from '@/lib/repo/posts';
import { requireSessionIdentity, requireUser } from '@/lib/session';
import { CreatePostFieldsSchema } from '@/lib/social-contracts';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const GET = route(async req => {
  const user = await requireUser(req);
  return json(await listPosts(user.id, communityPageInput(new URL(req.url), 12)));
});
export const POST = route(async req => {
  const { user, version } = await requireSessionIdentity(req);
  const form = await readFormData(req, LIMITS.postImage.maxBytes);
  const fields = CreatePostFieldsSchema.safeParse({ korean: form.get('korean'), meaningEn: form.get('meaningEn'), note: form.get('note') ?? '' });
  const file = form.get('image');
  if (!fields.success || !(file instanceof File)) throw new ApiError('invalid_input');
  if (file.size > LIMITS.postImage.maxBytes) throw new ApiError('audio_too_large');
  // Only clean JPEGs are stored: the browser re-encodes photos, and the server strips any metadata that remains.
  const image = inspectJpeg(new Uint8Array(await file.arrayBuffer()));
  const { minSide, maxSide } = LIMITS.postImage;
  if (!image || Math.min(image.width, image.height) < minSide || Math.max(image.width, image.height) > maxSide) throw new ApiError('media_invalid');
  const { korean, meaningEn, note } = fields.data;
  await assertImageAllowed(image.bytes, [korean, meaningEn, note]);
  return json(await createPost({ author: user, expectedVersion: version, korean, meaningEn, note, jpeg: image.bytes, width: image.width, height: image.height }), { status: 201 });
});
