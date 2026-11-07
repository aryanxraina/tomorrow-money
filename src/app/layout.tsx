import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Tomorrow: financial time travel',
  description: 'An AI money coach that sees problems coming and helps you fix them. Runs in the cloud or fully on your device.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#6d28d9' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
