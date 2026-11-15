import { z } from 'zod';
import missionsJson from '../../content/missions.json';
import rewardsJson from '../../content/rewards.json';
import challengesJson from '../../content/sample-challenges.json';
import { CreateChallengeFieldsSchema, MissionSchema, RewardSchema, SHARE_CODE_ALPHABET, type Mission, type Reward } from './contracts';
export type SampleChallenge = { code: string; korean: string; meaningEn: string; situationEn: string };
const missions = z.array(MissionSchema).parse(missionsJson);
const rewards = z.array(RewardSchema).parse(rewardsJson);
const samples = z.array(CreateChallengeFieldsSchema.extend({ code: z.string().length(6).refine(s => [...s].every(c => SHARE_CODE_ALPHABET.includes(c))) })).parse(challengesJson);
for (const values of [missions.map(m => m.id), rewards.map(r => r.id), samples.map(s => s.code)]) {
  if (new Set(values).size !== values.length) throw new Error('Content contains duplicate identifiers');
}
export function getMissions(): Mission[] { return missions; }
export function getMission(id: string): Mission | null { return missions.find(m => m.id === id) ?? null; }
export function getRewards(): Reward[] { return rewards; }
export function getSampleChallenges(): SampleChallenge[] { return samples; }
export function todaysMissionIds(dateKst: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) throw new Error('Invalid Korea-time date');
  const date = new Date(`${dateKst}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKst) throw new Error('Invalid Korea-time date');
  const dayOfYear = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  return [1, 2, 3].map(level => {
    const group = missions.filter(m => m.level === level);
    if (!group.length) throw new Error(`No missions for level ${level}`);
    return group[dayOfYear % group.length].id;
  });
}
