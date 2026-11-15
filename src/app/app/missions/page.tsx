'use client';
import { api } from '@/lib/api-client';
import { progressApi } from '@/lib/progress-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';
import { MissionLibrary } from '@/components/mission/MissionLibrary';
import { useSavedMissions } from '@/components/mission/useSavedMissions';
import styles from '@/components/mission/learning.module.css';

export default function MissionsPage() {
  const { user } = useSession();
  const missions = useApi(() => api.listMissions(), [user.id]);
  const progress = useApi(() => progressApi.summary(), [user.id]);
  const saved = useSavedMissions(progress.data?.savedMissionIds ?? []);
  return <div className={styles.page}><header className={styles.header}><p>Your everyday phrasebook</p><h1>Find your next words.</h1><p>From your first café order to a conversation that sounds like you. Save the expressions you want to come back to.</p></header>
    {missions.loading && <div className={styles.loading} role="status" aria-label="Loading missions"><span /><span /><span /></div>}
    {missions.error && <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(missions.error.code)}</StatusNote><Button onClick={missions.reload}>Try again</Button></div>}
    {progress.error && <div className="hl-stack-sm"><StatusNote tone="error">We couldn&apos;t load your saved expressions.</StatusNote><Button variant="secondary" onClick={progress.reload}>Retry saved expressions</Button></div>}
    {saved.error && <StatusNote tone="error">{saved.error}</StatusNote>}
    {missions.data && !missions.loading && !missions.error && <MissionLibrary missions={missions.data.missions} savedMissionIds={saved.savedMissionIds} savingId={saved.savingId} canSave={!!progress.data && !progress.loading && !progress.error} onToggleSaved={(id, value) => void saved.toggle(id, value)} />}
    <p className="hl-caption">A strong result means a practice score of 80 or more. It is a guide for your next try, not a language qualification.</p>
  </div>;
}
