'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useApi } from '@/lib/ui/use-api';
import { useSession } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, StatusNote } from '@/components/ui';
import { MissionFlow } from '@/components/mission/MissionFlow';
export default function MissionPage() {
  const { id } = useParams<{ id: string }>(); const { refreshBalance } = useSession();
  const request = useApi(() => api.listMissions(), []);
  if (request.loading) return <StatusNote tone="info">Opening your mission…</StatusNote>;
  if (request.error) return <div className="hl-stack-sm"><StatusNote tone="error">{errorCopy(request.error.code)}</StatusNote><Button onClick={request.reload}>Try again</Button></div>;
  const index = request.data?.missions.findIndex(m => m.id === id) ?? -1; const mission = request.data?.missions[index];
  if (!mission) return <div className="hl-stack"><h1>We couldn&apos;t find that.</h1><Link href="/app">Back to missions</Link></div>;
  const next = request.data?.missions[index + 1];
  return <div className="hl-stack"><Link className="hl-back-link" href="/app">← All missions</Link><MissionFlow key={mission.id} mission={mission} nextHref={next ? `/app/missions/${next.id}` : '/app'} onScored={() => void refreshBalance()} /></div>;
}
