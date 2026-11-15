import type { ApiErrorCode } from './contracts';
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  unauthenticated: 'Please choose a profile to continue.',
  forbidden: "You can't do that with this profile.",
  not_found: "We couldn't find that.", invalid_input: 'Please check the information you entered.',
  conflict: 'This answer has already been rated.',
  audio_too_large: "That recording didn't work. Please record again.",
  audio_invalid: "That recording didn't work. Please record again.",
  media_invalid: "That recording didn't work. Please record again.",
  no_speech: "We couldn't hear any Korean. Move closer to the mic and try again.",
  content_rejected: 'Please rephrase that. We keep HanLog friendly for everyone.',
  daily_limit: 'You have reached today’s limit for this action. Try again tomorrow.',
  scoring_failed: "That didn't score yet. Try again.",
  budget_exhausted: 'HanLog is resting for today. Too many learners at once. Try again tomorrow.',
  service_unavailable: 'We could not complete that. Please try again.', internal: 'We could not complete that. Please try again.',
};
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message = ERROR_MESSAGES[code]) { super(message); this.name = 'ApiError'; this.code = code; }
}
