import { notFound } from 'next/navigation';
import { CONTENT_KINDS } from '../../../../lib/admin';
import { ContentManager } from './ContentManager';

export default async function ContentKindPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!Object.hasOwn(CONTENT_KINDS, kind)) notFound();
  return <ContentManager kind={kind} />;
}
