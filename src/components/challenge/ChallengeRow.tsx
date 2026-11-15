import Link from 'next/link';
import type { Challenge } from '@/lib/contracts';
import { Ko } from '@/components/ui';
export function ChallengeRow({ challenge, status }: { challenge: Challenge; status?: string }) {
  return <Link href={`/app/challenges/${challenge.id}`} className="hl-mission-row"><span aria-hidden="true" className={`hl-marker hl-marker--${challenge.viewer.responded ? 'filled' : 'empty'}`}>{challenge.viewer.responded ? '✓' : ''}</span><span className="hl-row-copy"><Ko className="hl-row-korean">{challenge.korean}</Ko><span>{challenge.meaningEn}</span><span className="hl-caption">From {challenge.author.nickname}{challenge.isSample && <span className="hl-sample-label">Sample</span>}</span></span><span className="hl-row-meta">{status ?? (challenge.viewer.responded ? 'Answered' : challenge.viewer.pendingToRate ? `${challenge.viewer.pendingToRate} waiting` : 'Open')}<span aria-hidden="true">↗</span></span></Link>;
}
