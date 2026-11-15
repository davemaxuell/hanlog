import { expect, it } from 'vitest';
import { PEER_FEEDBACK_GIVER_AWARD, PEER_RATING_AWARD, POINT_LABELS, missionAward, peerFeedbackAuthorAward, peerResponseAward } from '@/lib/points/rules';

it('pays missions by tier', () => {
  expect([100, 85].map((o) => missionAward(10, o))).toEqual([10, 10]);
  expect([84, 70].map((o) => missionAward(10, o))).toEqual([6, 6]);
  expect([69, 50].map((o) => missionAward(10, o))).toEqual([3, 3]);
  expect([49, 0].map((o) => missionAward(10, o))).toEqual([0, 0]);
  expect(missionAward(20, 84)).toBe(12);
  expect(missionAward(20, 50)).toBe(6);
  expect(missionAward(30, 69)).toBe(9);
  expect(missionAward(30, 85)).toBe(30);
});
it('pays the peer loop', () => {
  expect(peerResponseAward(1, 1)).toBe(6);
  expect(peerResponseAward(4, 5)).toBe(27);
  expect(peerResponseAward(5, 5)).toBe(30);
  expect(PEER_RATING_AWARD).toBe(10);
  expect(PEER_FEEDBACK_GIVER_AWARD).toBe(5);
  expect([1, 5].map(peerFeedbackAuthorAward)).toEqual([2, 10]);
});
it('labels ledger entries as the spec says', () => {
  expect(POINT_LABELS.mission('만나서 반갑습니다.')).toBe('Mission: 만나서 반갑습니다.');
  expect(POINT_LABELS).toMatchObject({ peerResponse: 'Your answer was rated', peerRating: 'You rated an answer', feedbackGiven: 'Thanks for your feedback', feedbackReceived: 'Feedback on your rating' });
});
