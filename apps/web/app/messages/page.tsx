import type { Metadata } from 'next';
import { MessagesView } from './MessagesView';

export const metadata: Metadata = { title: 'Сообщения', robots: { index: false } };

export default function MessagesPage() {
  return <MessagesView />;
}
