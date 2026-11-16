import { jsonBody, read, request } from './api-client';
import type { ReportReason } from './community-contracts';
import {
  CreatedPostSchema, GroupDetailSchema, GroupListSchema, GroupSchema, LeaderboardSchema, LikeResultSchema, PostPageSchema,
  type LeaderboardPeriod,
} from './social-contracts';
import { z } from 'zod';

const id = (value: string) => encodeURIComponent(value);
export const socialApi = {
  leaderboard(period: LeaderboardPeriod) { return read(`/api/leaderboard?period=${period}`, LeaderboardSchema, { cache: 'no-store' }); },
  async setLeaderboardVisibility(visible: boolean) { await request('/api/leaderboard/visibility', jsonBody('PUT', { visible })); },

  feed(cursor?: string) { return read(`/api/posts?limit=12${cursor ? `&cursor=${id(cursor)}` : ''}`, PostPageSchema); },
  sharePost(input: { image: Blob; korean: string; meaningEn: string; note: string }) {
    const form = new FormData();
    form.set('image', input.image, 'moment.jpg'); form.set('korean', input.korean); form.set('meaningEn', input.meaningEn); form.set('note', input.note);
    return read('/api/posts', CreatedPostSchema, { method: 'POST', body: form });
  },
  setLike(postId: string, liked: boolean) { return read(`/api/posts/${id(postId)}/like`, LikeResultSchema, jsonBody('PUT', { liked })); },
  async reportPost(postId: string, reason: ReportReason) { await request(`/api/posts/${id(postId)}/report`, jsonBody('POST', { reason })); },
  async deletePost(postId: string) { await request(`/api/posts/${id(postId)}`, { method: 'DELETE' }); },

  groups() { return read('/api/groups', GroupListSchema); },
  createGroup(name: string) { return read('/api/groups', z.object({ group: GroupSchema }), jsonBody('POST', { name })); },
  joinGroup(code: string) { return read('/api/groups/join', z.object({ group: GroupSchema }), jsonBody('POST', { code })); },
  group(groupId: string, period: LeaderboardPeriod) { return read(`/api/groups/${id(groupId)}?period=${period}`, GroupDetailSchema, { cache: 'no-store' }); },
  async leaveGroup(groupId: string) { await request(`/api/groups/${id(groupId)}`, { method: 'DELETE' }); },
};
