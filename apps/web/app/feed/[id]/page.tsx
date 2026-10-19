import type { Metadata } from 'next';
import { PostView } from './PostView';

export const metadata: Metadata = { title: 'Обсуждение', robots: { index: false } };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return <PostView id={(await params).id} />;
}
