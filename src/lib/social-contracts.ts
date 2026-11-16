import { z } from 'zod';
import { LIMITS, RoleSchema, SHARE_CODE_ALPHABET, containsHangul, countChars } from './contracts';

const text = (max: number, min = 0) => z.string().trim().refine(s => countChars(s) >= min && countChars(s) <= max);
const uuid = z.uuid();
const timestamp = z.iso.datetime();
const integer = z.number().int().nonnegative();

export const LeaderboardPeriodSchema = z.enum(['today', 'all']);
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriodSchema>;
/** Ranked people. `rank` is shared on ties; `averageScore` is the mean of each person's best score per expression. */
export const RankedPersonSchema = z.object({
  rank: z.number().int().positive(), userId: uuid, nickname: z.string(), role: RoleSchema,
  points: integer, practised: integer, averageScore: z.number().int().min(0).max(100).nullable(), isMe: z.boolean(),
});
export type RankedPerson = z.infer<typeof RankedPersonSchema>;
export const LeaderboardSchema = z.object({
  period: LeaderboardPeriodSchema,
  entries: z.array(RankedPersonSchema).max(50),
  me: z.object({ rank: z.number().int().positive().nullable(), points: integer, visible: z.boolean() }),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
export const LeaderboardVisibilityInputSchema = z.object({ visible: z.boolean() });

export const PostSchema = z.object({
  id: uuid, author: z.object({ id: uuid, nickname: z.string(), role: RoleSchema }),
  korean: z.string(), meaningEn: z.string(), note: z.string(),
  width: z.number().int().positive(), height: z.number().int().positive(), imageUrl: z.string(),
  likes: integer, likedByMe: z.boolean(), mine: z.boolean(), createdAt: timestamp,
});
export type Post = z.infer<typeof PostSchema>;
export const PostPageSchema = z.object({ posts: z.array(PostSchema).max(50), nextCursor: z.string().nullable() });
export type PostPage = z.infer<typeof PostPageSchema>;
export const CreatePostFieldsSchema = z.object({
  korean: text(LIMITS.challengeKorean.max, LIMITS.challengeKorean.min).refine(containsHangul),
  meaningEn: text(LIMITS.meaningEn.max, LIMITS.meaningEn.min),
  note: text(LIMITS.postNote.max),
});
export const CreatedPostSchema = z.object({ post: PostSchema, pointsAwarded: integer });
export type CreatedPost = z.infer<typeof CreatedPostSchema>;
export const LikeInputSchema = z.object({ liked: z.boolean() });
export const LikeResultSchema = z.object({ likes: integer, likedByMe: z.boolean() });

const groupCode = z.string().trim().toUpperCase().refine(value => value.length === 6 && [...value].every(char => SHARE_CODE_ALPHABET.includes(char)));
export const GroupSchema = z.object({ id: uuid, code: z.string(), name: z.string(), memberCount: integer, isOwner: z.boolean(), createdAt: timestamp });
export type Group = z.infer<typeof GroupSchema>;
export const GroupListSchema = z.object({ groups: z.array(GroupSchema) });
export const GroupDetailSchema = z.object({ group: GroupSchema, period: LeaderboardPeriodSchema, members: z.array(RankedPersonSchema) });
export type GroupDetail = z.infer<typeof GroupDetailSchema>;
export const CreateGroupInputSchema = z.object({ name: text(LIMITS.groupName.max, LIMITS.groupName.min) });
export const JoinGroupInputSchema = z.object({ code: groupCode });
export const SOCIAL_LIMITS = { postsPerDay: 6, groupsCreatedPerDay: 5, groupsPerUser: 10, membersPerGroup: 50, postReportsToHide: 2 } as const;
