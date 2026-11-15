import Link from 'next/link';
import type { MissionWithProgress } from '@/lib/contracts';
import { Ko } from '@/components/ui';
export function MissionRow({ mission }: { mission: MissionWithProgress }) {
  const strong = mission.bestOverall !== null && mission.bestOverall >= 80;
  return <Link href={`/app/missions/${mission.id}`} className="hl-mission-row"><span className={`hl-marker hl-marker--${strong ? 'filled' : 'empty'}`} aria-hidden="true">{strong ? '✓' : ''}</span><span className="hl-row-copy"><Ko className="hl-row-korean">{mission.korean}</Ko><span className="hl-caption">{mission.meaningEn}</span></span><span className="hl-row-meta">{mission.bestOverall === null ? 'New' : `Best ${mission.bestOverall}`}<span aria-hidden="true">↗</span></span></Link>;
}
