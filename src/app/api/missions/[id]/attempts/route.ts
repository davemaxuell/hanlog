import { LIMITS, type Score } from '@/lib/contracts';
import { getMission } from '@/lib/content';
import { ApiError } from '@/lib/errors';
import { clientIpHash, json, readFormData, route } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { validateScoringWav, wavRms, WavError } from '@/lib/audio/wav';
import { reserveScoringCall, finishScoringCall } from '@/lib/limits';
import { scoreAttempt } from '@/lib/scoring';
import { NoSpeechError } from '@/lib/scoring/types';
import { recordAttempt } from '@/lib/repo/attempts';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const mission = getMission((await ctx.params).id);
  if (!mission) throw new ApiError('not_found');
  const form = await readFormData(req, LIMITS.scoringWav.maxBytes);
  const file = form.get('audio');
  if (!(file instanceof File)) throw new ApiError('invalid_input');
  if (file.size > LIMITS.scoringWav.maxBytes) throw new ApiError('audio_too_large');
  const wav = new Uint8Array(await file.arrayBuffer());
  try { validateScoringWav(wav); } catch (error) {
    if (error instanceof WavError) throw new ApiError(error.code === 'too_large' ? 'audio_too_large' : 'audio_invalid');
    throw error;
  }
  if (wavRms(wav) < LIMITS.silenceRms) throw new ApiError('no_speech');
  const reservation = await reserveScoringCall({ userId: user.id, ipHash: clientIpHash(req) });
  let score: Score;
  try { score = await scoreAttempt(wav, mission); } catch (error) {
    const noSpeech = error instanceof NoSpeechError;
    await finishScoringCall(reservation.id, noSpeech ? 'no_speech' : 'failed');
    throw new ApiError(noSpeech ? 'no_speech' : 'scoring_failed');
  }
  const result = await recordAttempt({ userId: user.id, mission, score });
  await finishScoringCall(reservation.id, 'scored');
  return json({ ...result, attemptsLeftToday: reservation.leftToday });
});
