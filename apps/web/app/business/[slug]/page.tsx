import { permanentRedirect } from 'next/navigation';

export default async function BusinessItemPage({ params }: { params: Promise<{ slug: string }> }) {
  permanentRedirect(`/organizations/${encodeURIComponent((await params).slug)}`);
}
