import { z } from 'zod';
import { AttemptSchema } from './contracts';

const count = z.number().int().nonnegative();
export const ProgressSummarySchema = z.object({
  totalAttempts: count, practicedMissions: count, strongMissions: count, totalMissions: count,
  practiceDays: count, currentStreak: count, longestStreak: count, practicedToday: z.boolean(),
  averageScore: z.number().min(0).max(100).nullable(),
  weeklyActivity: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), attempts: count })).length(7),
  recentAttempts: z.array(AttemptSchema).max(8),
  recommendedMissionId: z.string().nullable(), savedMissionIds: z.array(z.string()),
});
export type ProgressSummary = z.infer<typeof ProgressSummarySchema>;
export const AttemptHistorySchema = z.object({ attempts: z.array(AttemptSchema).max(30), nextCursor: z.string().nullable() });
export type AttemptHistory = z.infer<typeof AttemptHistorySchema>;
