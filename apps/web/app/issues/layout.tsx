import type { ReactNode } from 'react';
import { FeatureGate } from '../../components/content/FeatureGate';

export default function Layout({ children }: { children: ReactNode }) {
  return <FeatureGate feature="issues">{children}</FeatureGate>;
}
