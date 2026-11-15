'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { progressApi } from '@/lib/progress-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';
import { MissionFlow } from '@/components/mission/MissionFlow';
import { useSavedMissions } from '@/components/mission/useSavedMissions';
import styles from '@/components/mission/learning.module.css';
export default function MissionPage() {
  const { id } = useParams<{ id: string }>(); const { refreshBalance } = useSession();
  const request = useApi(() => api.listMissions(), []);
  const progress = useApi(() => progressApi.summary(), []);
  const saved = useSavedMissions(progress.data?.savedMissionIds ?? []);
  if (request.loading) return <StatusNote tone="info">Opening your mission…</StatusNote>;
  if (request.error) return <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(request.error.code)}</StatusNote><Button onClick={request.reload}>Try again</Button></div>;
  const index = request.data?.missions.findIndex(m => m.id === id) ?? -1; const mission = request.data?.missions[index];
  if (!mission) return <div className="hl-stack"><h1>We couldn&apos;t find that.</h1><Link href="/app/missions">Back to missions</Link></div>;
  const next = request.data?.missions.slice(index + 1).find(m => m.bestOverall === null) ?? request.data?.missions.find(m => m.id !== mission.id && m.bestOverall === null) ?? request.data?.missions[index + 1];
  const isSaved = saved.savedMissionIds.includes(mission.id);
  return <div className="hl-stack"><div className={styles.missionTop}><Link href="/app/missions">← All missions</Link><button type="button" className={styles.save} disabled={progress.loading || !!progress.error || saved.savingId !== null} aria-label={`${isSaved ? 'Remove saved expression' : 'Save expression'}: ${mission.meaningEn}`} aria-pressed={isSaved} onClick={() => void saved.toggle(mission.id, !isSaved)}><span aria-hidden="true">{isSaved ? '★' : '☆'}</span></button></div>{saved.error && <StatusNote tone="error">{saved.error}</StatusNote>}{progress.error && <div className="hl-stack-sm"><StatusNote tone="error">Saved expressions are unavailable. You can still practise.</StatusNote><Button variant="secondary" onClick={progress.reload}>Retry saved expressions</Button></div>}<MissionFlow key={mission.id} mission={mission} nextHref={next ? `/app/missions/${next.id}` : '/app/missions'} onScored={() => void refreshBalance()} /></div>;
}
