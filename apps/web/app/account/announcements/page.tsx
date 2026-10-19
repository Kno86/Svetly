import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MyAnnouncements } from './MyAnnouncements';

export const metadata: Metadata = { title: 'Мои объявления', robots: { index: false } };

export default function MyAnnouncementsPage() {
  return (
    <Suspense>
      <MyAnnouncements />
    </Suspense>
  );
}
