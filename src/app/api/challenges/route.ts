import { ChallengeScopeSchema, CreateChallengeFieldsSchema, LIMITS } from '@/lib/contracts';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { json, kstDayStartIso, readFormData, route } from '@/lib/http';
import { getMediaStore, validatePeerMedia } from '@/lib/media';
import { finishMediaRemoval, queueMediaRemoval } from '@/lib/media/pending';
import { assertTextAllowed } from '@/lib/moderation';
import { CHALLENGES_PER_DAY, countChallengesSince, createChallenge, getChallengeRecord, listChallenges, setChallengeReference, toChallenge } from '@/lib/repo/challenges';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const GET = route(async req => {
  const user = await requireUser(req);
  const parsed = ChallengeScopeSchema.safeParse(new URL(req.url).searchParams.get('scope') ?? 'open');
  if (!parsed.success) throw new ApiError('invalid_input');
  return json({ challenges: await listChallenges(parsed.data, user) });
});
export const POST = route(async req => {
  const user = await requireUser(req);
  if (user.role !== 'korean') throw new ApiError('forbidden');
  const form = await readFormData(req, LIMITS.peerMedia.maxBytes);
  const fields = CreateChallengeFieldsSchema.safeParse({ korean: form.get('korean'), meaningEn: form.get('meaningEn'), situationEn: form.get('situationEn') ?? '' });
  if (!fields.success) throw new ApiError('invalid_input');
  await assertTextAllowed([fields.data.korean, fields.data.meaningEn, fields.data.situationEn]);
  if (await countChallengesSince(user.id, kstDayStartIso()) >= CHALLENGES_PER_DAY) throw new ApiError('daily_limit');
  const file = form.get('media');
  const media = file === null ? null : await validatePeerMedia(file instanceof File ? file : null, 'audio', form.get('durationMs'));
  const record = await createChallenge({ authorId: user.id, ...fields.data });
  if (media) {
    const path = `references/${record.id}.${media.ext}`;
    try {
      // Register the path durably before storage can accept bytes.
      await queueMediaRemoval(path);
      await getMediaStore().put(path, media.bytes, media.mime);
      await setChallengeReference(record.id, path, media.mime);
    } catch {
      await (await getDb()).query('delete from hanlog.challenges where id = $1', [record.id]);
      try { await finishMediaRemoval(path); } catch { /* The durable queue lets cleanup retry. */ }
      throw new ApiError('service_unavailable');
    }
  }
  return json({ challenge: await toChallenge((await getChallengeRecord(record.id))!, user) }, { status: 201 });
});
