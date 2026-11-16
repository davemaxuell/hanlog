export function missionAward(basePoints: number, overall: number): number { return Math.round(basePoints * (overall >= 85 ? 1 : overall >= 70 ? 0.6 : overall >= 50 ? 0.3 : 0)); }
export function peerResponseAward(pronunciation: number, naturalness: number): number { return (pronunciation + naturalness) * 3; }
export const PEER_RATING_AWARD = 10;
export const PEER_FEEDBACK_GIVER_AWARD = 5;
/** Sharing a Korean moment: the first few posts each Korea day earn points, so the feed rewards taking part without rewarding spam. */
export const POST_AWARD = 5;
export const POSTS_REWARDED_PER_DAY = 3;
export function peerFeedbackAuthorAward(helpfulness: number): number { return helpfulness * 2; }
export const POINT_LABELS = {
  mission(korean: string): string { return `Mission: ${korean}`; }, peerResponse: 'Your answer was rated',
  peerRating: 'You rated an answer', feedbackGiven: 'Thanks for your feedback', feedbackReceived: 'Feedback on your rating', post: 'You shared a Korean moment',
};
