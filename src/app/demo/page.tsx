import type { Metadata } from 'next';
import { getMission, getMissions, getSampleChallenges } from '@/lib/content';
import { DemoExperience } from '@/components/demo/DemoExperience';

export const metadata: Metadata = {
  title: 'HanLog · Product walkthrough',
  description: 'One phrase, useful feedback, and a real connection. Explore HanLog or try it with your own voice.',
  robots: { index: false, follow: false },
};
export default function DemoPage() {
  const mission = getMission('cafe-iced-americano');
  const challenge = getSampleChallenges().find(item => item.code === 'SMPL24');
  if (!mission || !challenge) throw new Error('Presentation content is unavailable');
  return <><link rel="preload" as="image" href="/demo/hanlog-qr.svg" /><DemoExperience mission={mission} challenge={challenge} missionCount={getMissions().length} /></>;
}
