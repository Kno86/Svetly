import type { Metadata } from 'next';
import { FeedView } from './FeedView';

export const metadata: Metadata = {
  title: 'Лента',
  description: 'Посты жителей и открытых групп посёлка.',
};

export default function FeedPage() {
  return <FeedView />;
}
