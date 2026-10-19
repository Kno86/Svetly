import type { Metadata } from 'next';
import { OrganizationList } from '../../components/content/OrganizationList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Услуги', description: 'Местные мастера и услуги.' };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <OrganizationList
      kind="service"
      path="/services"
      title="Услуги"
      description="Местные мастера и частные специалисты. Рейтинги и отзывы появятся только после запуска модерации отзывов."
      sp={await searchParams}
    />
  );
}
