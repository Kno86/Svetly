import type { Metadata } from 'next';
import { ConversationView } from './ConversationView';

export const metadata: Metadata = { title: 'Переписка', robots: { index: false } };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  return <ConversationView id={(await params).id} />;
}
