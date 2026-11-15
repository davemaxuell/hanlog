import { z } from 'zod';

export const LIMITS = {
  nickname: { min: 2, max: 20 }, challengeKorean: { min: 1, max: 60 }, meaningEn: { min: 1, max: 120 },
  situationEn: { max: 200 }, comment: { max: 200 },
  scoringWav: { sampleRate: 16000, minMs: 500, maxMs: 20000, maxBytes: 700_000 },
  peerMedia: { maxBytes: 4_000_000, maxMs: 20000 }, recorder: { maxSeconds: 15, minMs: 500 }, silenceRms: 0.01,
} as const;
export const SHARE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
export const countChars = (s: string): number => Array.from(s).length;
export const containsHangul = (s: string): boolean => /[\uAC00-\uD7A3]/u.test(s);
export const hasLink = (s: string): boolean => /https?:\/\/|www\./i.test(s);
export const isValidNickname = (s: string): boolean => {
  const value = s.trim();
  return countChars(value) >= LIMITS.nickname.min && countChars(value) <= LIMITS.nickname.max && /^[\p{L}\p{M}\p{N} ._-]+$/u.test(value);
};
const text = (max: number, min = 0) => z.string().trim().refine(s => countChars(s) >= min && countChars(s) <= max);
const nickname = z.string().trim().refine(isValidNickname);
const uuid = z.uuid();
const timestamp = z.iso.datetime();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const integer = z.number().int().nonnegative();
const scoreNumber = z.number().int().min(0).max(100);
const stars = z.number().int().min(1).max(5);

export const RoleSchema = z.enum(['learner', 'korean']);
export type Role = z.infer<typeof RoleSchema>;
export const UserSchema = z.object({ id: uuid, nickname, role: RoleSchema, createdAt: timestamp });
export type User = z.infer<typeof UserSchema>;
export const MissionModeSchema = z.enum(['repeat', 'use']);
export type MissionMode = z.infer<typeof MissionModeSchema>;
const missionShape = {
  id: slug, mode: MissionModeSchema, korean: z.string().min(1), keyword: z.string().nullable(),
  romanization: z.string(), meaningEn: z.string(), situationEn: z.string(), promptEn: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]), basePoints: z.union([z.literal(10), z.literal(20), z.literal(30)]),
  referenceAudio: z.string().nullable(), tags: z.array(z.string()),
};
const missionRules = (m: { level: number; basePoints: number; mode: MissionMode; keyword: string | null; korean: string }) =>
  m.basePoints === m.level * 10 && (m.mode === 'repeat' ? m.keyword === null : !!m.keyword?.trim() && m.korean.includes(m.keyword));
export const MissionSchema = z.object(missionShape).refine(missionRules);
export type Mission = z.infer<typeof MissionSchema>;
export const MissionWithProgressSchema = z.object({ ...missionShape, bestOverall: scoreNumber.nullable(), pointsEarned: integer }).refine(missionRules);
export type MissionWithProgress = z.infer<typeof MissionWithProgressSchema>;
export const ScoreIssueSchema = z.object({ segment: text(200), problem: text(200), tip: text(200) });
export type ScoreIssue = z.infer<typeof ScoreIssueSchema>;
export const ScoreSchema = z.object({
  overall: scoreNumber, pronunciation: scoreNumber, accuracy: scoreNumber, usage: scoreNumber, heard: z.string(),
  issues: z.array(ScoreIssueSchema).max(3), praise: text(240), nextTip: text(240), scoredBy: z.enum(['ai', 'mock']),
});
export type Score = z.infer<typeof ScoreSchema>;
export const AttemptSchema = z.object({ id: uuid, missionId: slug, score: ScoreSchema, pointsAwarded: integer, createdAt: timestamp });
export type Attempt = z.infer<typeof AttemptSchema>;
export const AttemptResultSchema = z.object({ attempt: AttemptSchema, balance: integer, bestOverall: scoreNumber, attemptsLeftToday: integer });
export type AttemptResult = z.infer<typeof AttemptResultSchema>;
export const PointReasonSchema = z.enum(['mission', 'peer_response', 'peer_rating', 'peer_feedback']);
export type PointReason = z.infer<typeof PointReasonSchema>;
export const PointEventSchema = z.object({ id: uuid, delta: z.number().int(), reason: PointReasonSchema, label: z.string(), createdAt: timestamp });
export type PointEvent = z.infer<typeof PointEventSchema>;
export const PointsSummarySchema = z.object({ balance: integer, events: z.array(PointEventSchema).max(50) });
export type PointsSummary = z.infer<typeof PointsSummarySchema>;
export const RewardSchema = z.object({ id: slug, category: z.enum(['kpop', 'grocery', 'fashion', 'cafe']), title: z.string(), description: z.string(), cost: z.number().int().positive() });
export type Reward = z.infer<typeof RewardSchema>;
export const MediaKindSchema = z.enum(['audio', 'video']);
export type MediaKind = z.infer<typeof MediaKindSchema>;
export const MEDIA_TYPES: Record<string, { kind: MediaKind; ext: 'webm' | 'mp4' | 'ogg' | 'wav' }> = {
  'audio/webm': { kind: 'audio', ext: 'webm' }, 'audio/mp4': { kind: 'audio', ext: 'mp4' },
  'audio/ogg': { kind: 'audio', ext: 'ogg' }, 'audio/wav': { kind: 'audio', ext: 'wav' },
  'video/webm': { kind: 'video', ext: 'webm' }, 'video/mp4': { kind: 'video', ext: 'mp4' },
};
export const ChallengeScopeSchema = z.enum(['open', 'mine', 'to-rate', 'answered']);
export type ChallengeScope = z.infer<typeof ChallengeScopeSchema>;
export const CreateChallengeFieldsSchema = z.object({
  korean: text(LIMITS.challengeKorean.max, LIMITS.challengeKorean.min).refine(containsHangul),
  meaningEn: text(LIMITS.meaningEn.max, LIMITS.meaningEn.min), situationEn: text(LIMITS.situationEn.max),
});
const person = z.object({ id: uuid, nickname });
export const ChallengeSchema = z.object({
  id: uuid, code: z.string().length(6).refine(s => [...s].every(c => SHARE_CODE_ALPHABET.includes(c))), author: person,
  ...CreateChallengeFieldsSchema.shape, hasReference: z.boolean(), isSample: z.boolean(), createdAt: timestamp,
  viewer: z.object({ responded: z.boolean(), pendingToRate: integer }),
});
export type Challenge = z.infer<typeof ChallengeSchema>;
export const RatingInputSchema = z.object({ pronunciation: stars, naturalness: stars, comment: text(LIMITS.comment.max) });
export const FeedbackInputSchema = z.object({ helpfulness: stars, comment: text(LIMITS.comment.max) });
export const PeerRatingSchema = RatingInputSchema.extend({ ratedAt: timestamp });
export type PeerRating = z.infer<typeof PeerRatingSchema>;
export const PeerFeedbackSchema = FeedbackInputSchema.extend({ givenAt: timestamp });
export type PeerFeedback = z.infer<typeof PeerFeedbackSchema>;
export const ChallengeResponseSchema = z.object({
  id: uuid, challengeId: uuid, responder: person, mediaKind: MediaKindSchema, mediaAvailable: z.boolean(),
  durationMs: z.number().int().min(0).max(LIMITS.peerMedia.maxMs), status: z.enum(['pending', 'rated']),
  rating: PeerRatingSchema.nullable(), feedback: PeerFeedbackSchema.nullable(), createdAt: timestamp,
});
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;
export const ViewerRoleSchema = z.enum(['author', 'rater', 'responder', 'visitor']);
export type ViewerRole = z.infer<typeof ViewerRoleSchema>;
export const ChallengeDetailSchema = z.object({ challenge: ChallengeSchema, viewerRole: ViewerRoleSchema, myResponse: ChallengeResponseSchema.nullable(), responses: z.array(ChallengeResponseSchema) });
export type ChallengeDetail = z.infer<typeof ChallengeDetailSchema>;
export const ApiErrorCodeSchema = z.enum(['unauthenticated', 'forbidden', 'not_found', 'invalid_input', 'conflict', 'audio_too_large', 'audio_invalid', 'media_invalid', 'no_speech', 'content_rejected', 'daily_limit', 'scoring_failed', 'budget_exhausted', 'service_unavailable', 'internal']);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export const ApiErrorBodySchema = z.object({ error: z.object({ code: ApiErrorCodeSchema, message: z.string() }) });
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401, forbidden: 403, not_found: 404, invalid_input: 400, conflict: 409,
  audio_too_large: 413, audio_invalid: 415, media_invalid: 415, no_speech: 422, content_rejected: 422,
  daily_limit: 429, scoring_failed: 502, budget_exhausted: 503, service_unavailable: 503, internal: 500,
};
export const CreateSessionInputSchema = z.object({ nickname, role: RoleSchema, consent: z.literal(true) });
export const UpdateSessionInputSchema = z.object({ nickname: nickname.optional(), role: RoleSchema.optional() }).refine(v => v.nickname !== undefined || v.role !== undefined);
