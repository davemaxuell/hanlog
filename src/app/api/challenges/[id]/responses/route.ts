import { ApiError } from '@/lib/errors';
import { LIMITS } from '@/lib/contracts';
import { json, kstDayStartIso, readFormData, route } from '@/lib/http';
import { validatePeerMedia } from '@/lib/media';
import { getChallengeRecord } from '@/lib/repo/challenges';
import { RESPONSES_PER_DAY, countResponsesSince, publicResponse, upsertResponse } from '@/lib/repo/responses';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  if (user.role !== 'learner') throw new ApiError('forbidden');
  const challenge = await getChallengeRecord((await ctx.params).id);
  if (!challenge) throw new ApiError('not_found');
  if (challenge.authorId === user.id) throw new ApiError('forbidden');
  if (await countResponsesSince(user.id, kstDayStartIso()) >= RESPONSES_PER_DAY) throw new ApiError('daily_limit');
  const form = await readFormData(req, LIMITS.peerMedia.maxBytes);
  const file = form.get('media');
  const media = await validatePeerMedia(file instanceof File ? file : null, form.get('kind'), form.get('durationMs'));
  const { record } = await upsertResponse({ challengeId: challenge.id, responderId: user.id, mediaKind: media.kind, mediaMime: media.mime, ext: media.ext, durationMs: media.durationMs, bytes: media.bytes });
  return json({ response: publicResponse(record) }, { status: 201 });
});
