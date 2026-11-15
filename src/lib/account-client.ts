import { AccountStatusSchema, RecoveryResultSchema } from './account-contracts';
import { jsonBody, read, request } from './api-client';

export const accountApi = {
  status: () => read('/api/account', AccountStatusSchema),
  createRecoveryKey: () => read('/api/account/recovery-key', RecoveryResultSchema, { method: 'POST' }),
  restore: (recoveryKey: string, requestId = globalThis.crypto.randomUUID()) => read('/api/account/restore', RecoveryResultSchema, jsonBody('POST', { recoveryKey, requestId })),
  async logout(): Promise<void> { await request('/api/account/logout', { method: 'POST' }); },
  async exportData(): Promise<Blob> { return (await request('/api/account/export')).blob(); },
};
