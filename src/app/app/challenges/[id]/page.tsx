import { ChallengeDetailPage } from '@/components/challenge/ChallengeDetailPage';
export default async function Page({ searchParams }: { searchParams: Promise<{ response?: string | string[] }> }) {
  const { response } = await searchParams;
  return <ChallengeDetailPage focusedResponseId={typeof response === 'string' ? response : undefined} />;
}
