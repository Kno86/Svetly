import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin/AdminShell';

export const metadata: Metadata = {
  title: { default: 'Админ-платформа', template: '%s · Админ-платформа SVETLY' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
