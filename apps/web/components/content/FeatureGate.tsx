import type { ReactNode } from 'react';
import { apiGet } from '../../lib/content';
import { Empty } from './Blocks';
import styles from './content.module.css';

/** Server-side switch for a whole section layout; the API refuses the same routes with 404. */
export async function FeatureGate({ feature, children }: { feature: string; children: ReactNode }) {
  const res = await apiGet<Record<string, boolean>>('/api/features');
  if (!res.ok || res.data[feature] !== false) return children;
  return (
    <main id="main" className={`container ${styles.page}`}>
      <Empty
        filtered={false}
        title="Раздел временно отключён"
        description="Администратор выключил этот раздел. Остальные разделы работают как обычно."
      />
    </main>
  );
}
