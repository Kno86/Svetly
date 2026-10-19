import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MyCommunity } from './MyCommunity';

export const metadata: Metadata = { title: 'Мои обращения и публикации', robots: { index: false } };

export default function MyCommunityPage() {
  return (
    <Suspense>
      <MyCommunity />
    </Suspense>
  );
}
