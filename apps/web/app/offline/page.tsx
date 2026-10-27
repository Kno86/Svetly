import type { Metadata } from 'next';
import { EmptyState } from '../../components/ui/Feedback';

export const metadata: Metadata = { title: 'Нет подключения', robots: { index: false } };

export default function OfflinePage() {
  return (
    <main id="main" className="container" style={{ paddingBlock: 'var(--space-12)' }}>
      <EmptyState
        title="Нет подключения к интернету"
        description="SVETLY не сохраняет страницы и личные данные на устройстве, поэтому без сети они недоступны. Проверьте подключение и обновите страницу."
      />
    </main>
  );
}
