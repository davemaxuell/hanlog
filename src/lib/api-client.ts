import { z } from 'zod';
import {
  ApiErrorBodySchema, AttemptResultSchema, ChallengeDetailSchema, ChallengeResponseSchema, ChallengeSchema,
  MissionWithProgressSchema, PointsSummarySchema, RewardSchema, UserSchema,
  type ApiErrorCode, type AttemptResult, type Challenge, type ChallengeDetail, type ChallengeResponse, type ChallengeScope,
  type MediaKind, type MissionWithProgress, type PointsSummary, type Reward, type Role, type User,
} from './contracts';

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  constructor(code: ApiErrorCode, status: number, message: string) { super(message); this.name = 'ApiClientError'; this.code = code; this.status = status; }
}
const failure = (status: number) => new ApiClientError('internal', status, 'We could not complete that. Please try again.');
export async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(url, { ...init, credentials: 'same-origin' }); }
  catch { throw failure(0); }
  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { throw failure(response.status); }
    const result = ApiErrorBodySchema.safeParse(body);
    if (result.success) throw new ApiClientError(result.data.error.code, response.status, result.data.error.message);
    throw failure(response.status);
  }
  return response;
}
export async function read<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await request(url, init);
  try { return schema.parse(await response.json()); } catch { throw failure(response.status); }
}
export const jsonBody = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const encode = encodeURIComponent;
const userEnvelope = z.object({ user: UserSchema });
const responseEnvelope = z.object({ response: ChallengeResponseSchema });

export const api = {
  async getSession(): Promise<User | null> { return (await read('/api/session', z.object({ user: UserSchema.nullable() }))).user; },
  async createSession(input: { nickname: string; role: Role }): Promise<User> { return (await read('/api/session', userEnvelope, jsonBody('POST', { ...input, consent: true }))).user; },
  async updateSession(patch: { nickname?: string; role?: Role }): Promise<User> { return (await read('/api/session', userEnvelope, jsonBody('PATCH', patch))).user; },
  async deleteSession(): Promise<void> { await request('/api/session', { method: 'DELETE' }); },
  listMissions(): Promise<{ missions: MissionWithProgress[]; today: string[] }> { return read('/api/missions', z.object({ missions: z.array(MissionWithProgressSchema), today: z.array(z.string()) })); },
  submitAttempt(missionId: string, wav: Uint8Array): Promise<AttemptResult> {
    const body = new FormData();
    body.set('audio', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'recording.wav');
    return read(`/api/missions/${encode(missionId)}/attempts`, AttemptResultSchema, { method: 'POST', body });
  },
  getPoints(): Promise<PointsSummary> { return read('/api/points', PointsSummarySchema); },
  async listRewards(): Promise<Reward[]> { return (await read('/api/rewards', z.object({ rewards: z.array(RewardSchema) }))).rewards; },
  async listChallenges(scope: ChallengeScope): Promise<Challenge[]> { return (await read(`/api/challenges?scope=${encode(scope)}`, z.object({ challenges: z.array(ChallengeSchema).max(50) }))).challenges; },
  async createChallenge(input: { korean: string; meaningEn: string; situationEn: string; media?: { blob: Blob; durationMs: number } }): Promise<Challenge> {
    const body = new FormData();
    body.set('korean', input.korean); body.set('meaningEn', input.meaningEn); body.set('situationEn', input.situationEn);
    if (input.media) { body.set('media', input.media.blob, 'reference'); body.set('durationMs', String(input.media.durationMs)); }
    return (await read('/api/challenges', z.object({ challenge: ChallengeSchema }), { method: 'POST', body })).challenge;
  },
  getChallenge(idOrCode: string): Promise<ChallengeDetail> { return read(`/api/challenges/${encode(idOrCode)}`, ChallengeDetailSchema); },
  async submitResponse(challengeId: string, input: { blob: Blob; kind: MediaKind; durationMs: number }): Promise<ChallengeResponse> {
    const body = new FormData();
    body.set('media', input.blob, 'answer'); body.set('kind', input.kind); body.set('durationMs', String(input.durationMs));
    return (await read(`/api/challenges/${encode(challengeId)}/responses`, responseEnvelope, { method: 'POST', body })).response;
  },
  async rateResponse(responseId: string, input: { pronunciation: number; naturalness: number; comment: string }): Promise<ChallengeResponse> {
    return (await read(`/api/responses/${encode(responseId)}/rating`, responseEnvelope, jsonBody('POST', input))).response;
  },
  async giveFeedback(responseId: string, input: { helpfulness: number; comment: string }): Promise<ChallengeResponse> {
    return (await read(`/api/responses/${encode(responseId)}/feedback`, responseEnvelope, jsonBody('POST', input))).response;
  },
  async reportResponse(responseId: string): Promise<void> { await request(`/api/responses/${encode(responseId)}/report`, { method: 'POST' }); },
  mediaUrl: {
    response(responseId: string): string { return `/api/responses/${encode(responseId)}/media`; },
    reference(challengeId: string): string { return `/api/challenges/${encode(challengeId)}/reference`; },
  },
  async fetchMediaBlobUrl(url: string): Promise<string> {
    const response = await request(url);
    try { return URL.createObjectURL(await response.blob()); } catch { throw failure(response.status); }
  },
};
