import {
  UserSchema, MissionWithProgressSchema, AttemptResultSchema, PointsSummarySchema, RewardSchema,
  ChallengeSchema, ChallengeDetailSchema, ChallengeResponseSchema,
} from '@/lib/contracts';
import { getMissions, getRewards } from '@/lib/content';
const createdAt = '2026-11-15T01:00:00.000Z';
const user = UserSchema.parse({ id: '00000000-0000-4000-8000-000000000010', nickname: 'Aisha', role: 'learner', createdAt });
const koreanUser = UserSchema.parse({ id: '00000000-0000-4000-8000-000000000011', nickname: 'Minji', role: 'korean', createdAt });
const ids = ['cafe-iced-americano', 'greet-nice-to-meet', 'store-no-receipt', 'transit-this-stop', 'slang-daebak', 'campus-group-roles'];
const missions = getMissions().filter(m => ids.includes(m.id)).map(m => MissionWithProgressSchema.parse({ ...m, bestOverall: null, pointsEarned: 0 }));
const attemptResult = AttemptResultSchema.parse({
  attempt: { id: '00000000-0000-4000-8000-000000000020', missionId: 'cafe-iced-americano',
    score: { overall: 88, pronunciation: 84, accuracy: 96, usage: 88, heard: '아이스 아메리카노 한 잔 주세요.',
      issues: [{ segment: '잔', problem: 'Demo feedback: the final consonant was a little soft.', tip: 'Hold the final consonant briefly before the next syllable.' }],
      praise: 'Clear and confident. Nice work.', nextTip: 'Try it once more at natural speed.', scoredBy: 'mock' },
    pointsAwarded: 10, createdAt }, balance: 10, bestOverall: 88, attemptsLeftToday: 29,
});
const points = PointsSummarySchema.parse({ balance: 10, events: [{ id: '00000000-0000-4000-8000-000000000030', delta: 10, reason: 'mission', label: 'Mission: 아이스 아메리카노 한 잔 주세요.', createdAt }] });
const rewards = getRewards().map(r => RewardSchema.parse(r));
const challenge = ChallengeSchema.parse({
  id: '00000000-0000-4000-8000-000000000040', code: 'ABC234', author: { id: koreanUser.id, nickname: koreanUser.nickname },
  korean: '오늘 점메추 좀 해 줘.', meaningEn: 'Recommend lunch to a friend.', situationEn: 'Before lunch with a classmate.',
  hasReference: false, isSample: false, createdAt, viewer: { responded: false, pendingToRate: 1 },
});
const response = ChallengeResponseSchema.parse({
  id: '00000000-0000-4000-8000-000000000050', challengeId: challenge.id,
  responder: { id: user.id, nickname: user.nickname }, mediaKind: 'audio', mediaAvailable: true, durationMs: 3000,
  status: 'pending', rating: null, feedback: null, createdAt,
});
const ratedResponse = ChallengeResponseSchema.parse({ ...response, status: 'rated', rating: { pronunciation: 4, naturalness: 5, comment: '좋아요!', ratedAt: createdAt } });
const challengeDetailForLearner = ChallengeDetailSchema.parse({ challenge: { ...challenge, viewer: { responded: true, pendingToRate: 0 } }, viewerRole: 'responder', myResponse: response, responses: [] });
const challengeDetailForAuthor = ChallengeDetailSchema.parse({ challenge, viewerRole: 'author', myResponse: null, responses: [response] });
export const samples = { user, koreanUser, missions, attemptResult, points, rewards, challenge, challengeDetailForLearner, challengeDetailForAuthor, response, ratedResponse };
