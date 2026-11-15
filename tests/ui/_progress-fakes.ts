import { ProgressSummarySchema, type ProgressSummary } from '@/lib/progress-contracts';
export function progressSummary(over: Partial<ProgressSummary> = {}): ProgressSummary {
  return ProgressSummarySchema.parse({ totalAttempts: 0, practicedMissions: 0, strongMissions: 0, totalMissions: 24, practiceDays: 0,
    currentStreak: 0, longestStreak: 0, practicedToday: false, averageScore: null,
    weeklyActivity: Array.from({ length: 7 }, (_, index) => ({ date: `2026-11-${10 + index}`, attempts: 0 })),
    recentAttempts: [], recommendedMissionId: 'cafe-iced-americano', savedMissionIds: [], ...over });
}
