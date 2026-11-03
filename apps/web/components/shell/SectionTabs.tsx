'use client';

import { usePathname } from 'next/navigation';
import { visibleWith, useFeatures } from '../../lib/features';
import { LinkTabs } from '../ui/Navigation';
import { tabsFor } from './navigation';
import styles from './shell.module.css';

export function SectionTabs() {
  const pathname = usePathname();
  const features = useFeatures();
  const tabs = tabsFor(pathname);
  if (!tabs) return null;
  const items = visibleWith(tabs.items, features).map((i) => ({
    label: i.label,
    href: i.href,
    current: i.href === pathname,
  }));
  return (
    <div className={`container ${styles.sectionTabs}`}>
      <LinkTabs label={`Вкладки раздела «${tabs.section.label}»`} items={items} />
    </div>
  );
}
