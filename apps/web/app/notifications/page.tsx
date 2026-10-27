import type { Metadata } from 'next';
import { NotificationsView } from './NotificationsView';

export const metadata: Metadata = { title: 'Уведомления', robots: { index: false } };

export default function NotificationsPage() {
  return <NotificationsView />;
}
