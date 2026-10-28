import '@fontsource-variable/golos-text/wght.css';
import '@fontsource-variable/literata/wght.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '../components/analytics/Analytics';
import { ServiceWorker } from '../components/pwa/ServiceWorker';
import { SiteFooter } from '../components/shell/SiteFooter';
import { SiteHeader } from '../components/shell/SiteHeader';
import { indexingEnabled } from '../lib/seo';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SVETLY_PUBLIC_URL ?? 'http://localhost:3000'),
  title: { default: 'SVETLY', template: '%s — SVETLY' },
  description:
    'SVETLY — цифровая платформа жителей посёлка Октябрьский и жилого района Светлый (в разработке).',
  robots: indexingEnabled() ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { title: 'SVETLY', images: ['/brand/og-image.png'], locale: 'ru_RU', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#103C2F' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <a href="#main" className="skip-link">
          Перейти к содержанию
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
        <ServiceWorker />
      </body>
    </html>
  );
}
