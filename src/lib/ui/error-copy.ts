import type { ApiErrorCode } from '@/lib/contracts';
export function errorCopy(code: ApiErrorCode | 'undecodable' | 'too_short'): string {
  switch (code) {
    case 'unauthenticated': return '';
    case 'no_speech': return "We couldn't hear any Korean. Move closer to the mic and try again.";
    case 'audio_invalid': case 'audio_too_large': case 'media_invalid': case 'undecodable': return "That recording didn't work. Please record again.";
    case 'too_short': return 'That was too short. Speak for at least a second.';
    case 'daily_limit': return "You've reached today's practice limit. Come back tomorrow!";
    case 'budget_exhausted': return 'HanLog is resting for today. Too many learners at once. Try again tomorrow.';
    case 'content_rejected': return 'Please rephrase that. We keep HanLog friendly for everyone.';
    case 'forbidden': return "You can't do that with this profile.";
    case 'not_found': return "We couldn't find that.";
    case 'conflict': return 'This answer has already been rated.';
    case 'invalid_input': return 'Please check the details and try again.';
    default: return "That didn't score yet. Try again.";
  }
}
