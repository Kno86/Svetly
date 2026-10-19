import type { Metadata } from 'next';
import { BusinessDashboard } from './BusinessDashboard';

export const metadata: Metadata = { title: 'Кабинет бизнеса', robots: { index: false } };

export default function BusinessPage() {
  return <BusinessDashboard />;
}
