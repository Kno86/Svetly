import type { Metadata } from 'next';
import { OrganizationList } from '../../components/content/OrganizationList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Организации',
  description: 'Магазины, учреждения и сервисы территории.',
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <OrganizationList
      kind="organization"
      path="/organizations"
      title="Организации"
      description="Магазины, учреждения и сервисы. У каждой карточки указаны источник и дата проверки."
      sp={await searchParams}
    />
  );
}
