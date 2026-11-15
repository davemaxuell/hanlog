import { read, request, jsonBody } from './api-client';
import type { ChallengeScope } from './contracts';
import { ChallengePageSchema, CommunityDetailSchema, InboxPageSchema, ResponsePageSchema, type ReportReason } from './community-contracts';
const params = (input: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== '') query.set(key, String(value));
  return query.toString();
};
export const communityApi = {
  listChallenges(scope: ChallengeScope, options: { cursor?: string; q?: string; limit?: number } = {}) { return read(`/api/challenges?${params({ scope, limit: 12, ...options })}`, ChallengePageSchema); },
  getChallenge(id: string, response?: string) { return read(`/api/challenges/${encodeURIComponent(id)}${response ? `?${params({ response })}` : ''}`, CommunityDetailSchema); },
  listResponses(id: string, cursor?: string) { return read(`/api/challenges/${encodeURIComponent(id)}/responses?${params({ limit: 20, cursor })}`, ResponsePageSchema); },
  getInbox(cursor?: string) { return read(`/api/community/inbox?${params({ limit: 12, cursor })}`, InboxPageSchema); },
  async reportResponse(id: string, reason: ReportReason) { await request(`/api/responses/${encodeURIComponent(id)}/report`, jsonBody('POST', { reason })); },
  async reportChallenge(id: string, reason: ReportReason) { await request(`/api/challenges/${encodeURIComponent(id)}/report`, jsonBody('POST', { reason })); },
};
