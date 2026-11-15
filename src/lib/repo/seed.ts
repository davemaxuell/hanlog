import type { Db } from '../db';
import { SYSTEM_USER_ID } from '../contracts';
import { getSampleChallenges } from '../content';
export async function ensureSeed(db: Db): Promise<void> {
  await db.tx(async tx => {
    await tx.query("insert into hanlog.users (id, nickname, role, ip_hash) values ($1, 'HanLog 팀', 'korean', 'system') on conflict (id) do nothing", [SYSTEM_USER_ID]);
    for (const sample of getSampleChallenges()) {
      await tx.query(`insert into hanlog.challenges (code, author_id, korean, meaning_en, situation_en, is_sample)
        values ($1, $2, $3, $4, $5, true) on conflict (code) do nothing`, [sample.code, SYSTEM_USER_ID, sample.korean, sample.meaningEn, sample.situationEn]);
    }
  });
}
