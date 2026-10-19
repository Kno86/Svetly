import type { Metadata } from 'next';
import { GroupView } from './GroupView';

export const metadata: Metadata = { title: 'Группа' };

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  return <GroupView slug={(await params).slug} />;
}
