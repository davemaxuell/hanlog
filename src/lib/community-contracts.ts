import { z } from 'zod';
import { ChallengeDetailSchema, ChallengeResponseSchema, ChallengeSchema } from './contracts';

export const ReportReasonSchema = z.enum(['harassment', 'inappropriate', 'spam', 'privacy', 'other']);
export type ReportReason = z.infer<typeof ReportReasonSchema>;
export const ReportInputSchema = z.object({ reason: ReportReasonSchema });
export const REPORT_REASONS: Record<ReportReason, string> = {
  harassment: 'Harassment or bullying', inappropriate: 'Inappropriate content', spam: 'Spam or advertising', privacy: 'Privacy concern', other: 'Another concern',
};
export const ChallengePageSchema = z.object({ challenges: z.array(ChallengeSchema).max(50), nextCursor: z.string().nullable() });
export type ChallengePage = z.infer<typeof ChallengePageSchema>;
export const ResponsePageSchema = z.object({ responses: z.array(ChallengeResponseSchema).max(50), nextCursor: z.string().nullable() });
export type ResponsePage = z.infer<typeof ResponsePageSchema>;
export const CommunityDetailSchema = ChallengeDetailSchema.extend({ responsesNextCursor: z.string().nullable().optional() });
export type CommunityDetail = z.infer<typeof CommunityDetailSchema>;
export const InboxItemSchema = z.object({
  id: z.string(), kind: z.enum(['rating', 'feedback']), responseId: z.uuid(), challengeId: z.uuid(),
  korean: z.string(), meaningEn: z.string(), nickname: z.string(), comment: z.string(), createdAt: z.iso.datetime(),
  pronunciation: z.number().int().min(1).max(5).nullable(), naturalness: z.number().int().min(1).max(5).nullable(),
  helpfulness: z.number().int().min(1).max(5).nullable(), needsFeedback: z.boolean(),
});
export const InboxPageSchema = z.object({ items: z.array(InboxItemSchema).max(50), nextCursor: z.string().nullable() });
export type InboxItem = z.infer<typeof InboxItemSchema>;
export type InboxPage = z.infer<typeof InboxPageSchema>;
