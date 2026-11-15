import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { createPgDb } from '../src/lib/db/pg';
import { reviewReport } from '../src/lib/repo/community';

type Command = { action: 'list'; status: 'open' | 'dismissed' | 'actioned'; limit: number } | { action: 'review'; id: string; decision: 'dismissed' | 'actioned'; apply: boolean };
export function parseReportCommand(args: string[]): Command {
  if (args[0] === 'list') {
    if (args.slice(1).some(arg => !/^(--status=(open|dismissed|actioned)|--limit=\d+)$/.test(arg)) || new Set(args.slice(1).map(arg => arg.split('=')[0])).size !== args.length - 1) throw new Error('Invalid command');
    const status = (args.find(arg => arg.startsWith('--status='))?.split('=')[1] ?? 'open') as 'open' | 'dismissed' | 'actioned';
    const limit = Number(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] ?? 20);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid limit');
    return { action: 'list', status, limit };
  }
  if (args[0] === 'review' && (args.length === 3 || args.length === 4) && z.uuid().safeParse(args[1]).success && ['dismissed', 'actioned'].includes(args[2]) && (args.length === 3 || args[3] === '--apply')) {
    return { action: 'review', id: args[1], decision: args[2] as 'dismissed' | 'actioned', apply: args[3] === '--apply' };
  }
  throw new Error('Invalid command');
}
async function main() {
  let command: Command;
  try { command = parseReportCommand(process.argv.slice(2)); }
  catch { console.error('Usage: tsx scripts/review-community-reports.ts list [--status=open|dismissed|actioned] [--limit=20]\n       tsx scripts/review-community-reports.ts review <report-uuid> dismissed|actioned [--apply]'); process.exitCode = 1; return; }
  if (command.action === 'review' && !command.apply) { console.log(`Dry run: ${command.decision} report ${command.id}. Add --apply to perform this operator review.`); return; }
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) { console.error('Configure a server-only Postgres connection before using this operator command. Environment files are not loaded automatically.'); process.exitCode = 1; return; }
  const db = createPgDb(url);
  try {
    if (command.action === 'list') console.log(JSON.stringify(await db.query('select id,challenge_id,response_id,reason,status,created_at,reviewed_at from hanlog.community_reports where status=$1 order by created_at,id limit $2', [command.status, command.limit]), null, 2));
    else { await reviewReport(db, command.id, command.decision); console.log('Report reviewed. Visibility recalculated from the reports on this target.'); }
  } catch { console.error('Report operation failed. Check the connection, migrations, and report ID.'); process.exitCode = 1; }
  finally { await db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
