import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Tomorrow',
  description: 'See money problems coming. Forecast your next 90 days, find help you may be missing, and get a short plan. Your data stays on your device unless you choose otherwise.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eaf0ea' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1510' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
