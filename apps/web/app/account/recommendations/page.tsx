import type { Metadata } from 'next';
import { RecommendationsView } from './RecommendationsView';

export const metadata: Metadata = { title: 'Рекомендации', robots: { index: false } };

export default function RecommendationsPage() {
  return <RecommendationsView />;
}
