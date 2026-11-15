import { AttemptHistorySchema, ProgressSummarySchema } from './progress-contracts';
import { read, request } from './api-client';

export const progressApi = {
  summary: () => read('/api/progress', ProgressSummarySchema),
  history: (options: { cursor?: string; missionId?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (options.cursor) query.set('cursor', options.cursor);
    if (options.missionId) query.set('missionId', options.missionId);
    if (options.limit !== undefined) query.set('limit', String(options.limit));
    return read(`/api/progress/attempts${query.size ? `?${query}` : ''}`, AttemptHistorySchema);
  },
  async saveMission(missionId: string, saved: boolean): Promise<void> {
    await request(`/api/progress/saved/${encodeURIComponent(missionId)}`, { method: saved ? 'PUT' : 'DELETE' });
  },
};
