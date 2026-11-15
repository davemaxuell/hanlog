import { describe, expect, it } from 'vitest';
import {
  API_ERROR_STATUS, CreateChallengeFieldsSchema, CreateSessionInputSchema, FeedbackInputSchema, LIMITS,
  MEDIA_TYPES, MissionSchema, RatingInputSchema, UpdateSessionInputSchema,
  containsHangul, countChars, hasLink, isValidNickname,
} from '@/lib/contracts';

const mission = {
  id: 'cafe-iced-americano', mode: 'repeat', korean: '아이스 아메리카노 한 잔 주세요.', keyword: null,
  romanization: 'aiseu amerikano han jan juseyo', meaningEn: 'One iced americano, please.',
  situationEn: 's', promptEn: 'p', level: 1, basePoints: 10, referenceAudio: null, tags: ['cafe'],
};

describe('contracts', () => {
  it('counts code points and validates nicknames', () => {
    expect(countChars('한🙂a')).toBe(3);
    expect(isValidNickname('아이샤')).toBe(true);
    expect(isValidNickname('Leo_2-b.')).toBe(true);
    expect(isValidNickname('a')).toBe(false);
    expect(isValidNickname('x'.repeat(21))).toBe(false);
    expect(isValidNickname('bad<name>')).toBe(false);
    expect(isValidNickname('  ')).toBe(false);
  });
  it('detects Hangul and links', () => {
    expect(containsHangul('daebak 대박')).toBe(true);
    expect(containsHangul('daebak')).toBe(false);
    expect(hasLink('see www.example.com')).toBe(true);
    expect(hasLink('see https://x.y')).toBe(true);
    expect(hasLink('no link here')).toBe(false);
  });
  it('requires consent to be true', () => {
    expect(CreateSessionInputSchema.safeParse({ nickname: 'Aisha', role: 'learner', consent: true }).success).toBe(true);
    expect(CreateSessionInputSchema.safeParse({ nickname: 'Aisha', role: 'learner', consent: false }).success).toBe(false);
    expect(CreateSessionInputSchema.safeParse({ nickname: 'Aisha', role: 'admin', consent: true }).success).toBe(false);
  });
  it('needs at least one field to update a session', () => {
    expect(UpdateSessionInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateSessionInputSchema.safeParse({ role: 'korean' }).success).toBe(true);
  });
  it('validates missions', () => {
    expect(MissionSchema.safeParse(mission).success).toBe(true);
    expect(MissionSchema.safeParse({ ...mission, basePoints: 20 }).success).toBe(false);            // must equal level * 10
    expect(MissionSchema.safeParse({ ...mission, mode: 'use' }).success).toBe(false);                // use needs a keyword
    expect(MissionSchema.safeParse({ ...mission, mode: 'use', keyword: '대박' }).success).toBe(false); // keyword must appear in korean
    expect(MissionSchema.safeParse({ ...mission, keyword: '잔' }).success).toBe(false);              // repeat must have null keyword
  });
  it('validates challenge fields', () => {
    const ok = { korean: '오늘 점메추 좀 해 줘.', meaningEn: 'Recommend lunch.', situationEn: '' };
    expect(CreateChallengeFieldsSchema.safeParse(ok).success).toBe(true);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, korean: 'jeommechu' }).success).toBe(false);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, korean: '가'.repeat(61) }).success).toBe(false);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, meaningEn: '' }).success).toBe(false);
    expect(CreateChallengeFieldsSchema.safeParse({ ...ok, situationEn: 'x'.repeat(201) }).success).toBe(false);
  });
  it('validates stars', () => {
    expect(RatingInputSchema.safeParse({ pronunciation: 5, naturalness: 1, comment: '' }).success).toBe(true);
    expect(RatingInputSchema.safeParse({ pronunciation: 0, naturalness: 3, comment: '' }).success).toBe(false);
    expect(RatingInputSchema.safeParse({ pronunciation: 4.5, naturalness: 3, comment: '' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ helpfulness: 6, comment: '' }).success).toBe(false);
    expect(FeedbackInputSchema.safeParse({ helpfulness: 3, comment: 'x'.repeat(201) }).success).toBe(false);
  });
  it('pins limits, statuses, and media types', () => {
    expect(LIMITS.scoringWav).toEqual({ sampleRate: 16000, minMs: 500, maxMs: 20000, maxBytes: 700_000 });
    expect(LIMITS.peerMedia).toEqual({ maxBytes: 4_000_000, maxMs: 20000 });
    expect(LIMITS.recorder).toEqual({ maxSeconds: 15, minMs: 500 });
    expect(LIMITS.silenceRms).toBe(0.01);
    expect(API_ERROR_STATUS.no_speech).toBe(422);
    expect(API_ERROR_STATUS.budget_exhausted).toBe(503);
    expect(API_ERROR_STATUS.audio_too_large).toBe(413);
    expect(Object.keys(API_ERROR_STATUS)).toHaveLength(15);
    expect(MEDIA_TYPES['video/mp4']).toEqual({ kind: 'video', ext: 'mp4' });
    expect(Object.keys(MEDIA_TYPES).sort()).toEqual(['audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm']);
  });
});
