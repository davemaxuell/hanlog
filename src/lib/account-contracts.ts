import { z } from 'zod';
import { UserSchema } from './contracts';

export const RecoveryKeySchema = z.string().trim().regex(/^hlk_[A-Za-z0-9_-]{43}$/);
export const RestoreAccountInputSchema = z.object({ recoveryKey: RecoveryKeySchema, requestId: z.uuid().transform(value => value.toLowerCase()) });
export const AccountStatusSchema = z.object({ recoveryEnabled: z.boolean(), recoveryUpdatedAt: z.iso.datetime().nullable() });
export type AccountStatus = z.infer<typeof AccountStatusSchema>;
export const RecoveryResultSchema = z.object({ user: UserSchema, recoveryKey: RecoveryKeySchema });
export type RecoveryResult = z.infer<typeof RecoveryResultSchema>;
