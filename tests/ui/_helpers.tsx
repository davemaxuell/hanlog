import { vi, type Mock } from 'vitest';
import type { api } from '@/lib/api-client';
export const nav = { push: vi.fn(), replace: vi.fn(), params: {} as Record<string, string>, pathname: '/app', search: new URLSearchParams() };
const router = { push: nav.push, replace: nav.replace };
export const navigationMock = { useRouter: () => router, useParams: () => nav.params, usePathname: () => nav.pathname, useSearchParams: () => nav.search };
export const mockApi = Object.fromEntries(['getSession', 'createSession', 'updateSession', 'deleteSession', 'listMissions', 'submitAttempt', 'getPoints', 'listRewards', 'listChallenges', 'createChallenge', 'getChallenge', 'submitResponse', 'rateResponse', 'giveFeedback', 'reportResponse', 'fetchMediaBlobUrl'].map(key => [key, vi.fn()])) as unknown as { [K in Exclude<keyof typeof api, 'mediaUrl'>]: Mock } & { mediaUrl: { response: Mock; reference: Mock } };
mockApi.mediaUrl = { response: vi.fn(), reference: vi.fn() };
export function resetMocks() {
  for (const value of Object.values(mockApi)) { if (typeof value === 'function') value.mockReset(); }
  mockApi.mediaUrl.response.mockReset().mockImplementation((id: string) => `/api/responses/${id}/media`);
  mockApi.mediaUrl.reference.mockReset().mockImplementation((id: string) => `/api/challenges/${id}/reference`);
  mockApi.getPoints.mockResolvedValue({ balance: 0, events: [] });
  mockApi.listChallenges.mockResolvedValue([]);
  nav.push.mockReset(); nav.replace.mockReset(); nav.params = {}; nav.pathname = '/app'; nav.search = new URLSearchParams();
}
