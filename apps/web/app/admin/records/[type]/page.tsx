import { notFound } from 'next/navigation';
import { RECORD_TYPES } from '../../../../lib/admin';
import { RecordsManager } from './RecordsManager';

export default async function RecordsPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!Object.hasOwn(RECORD_TYPES, type)) notFound();
  return <RecordsManager type={type} />;
}
