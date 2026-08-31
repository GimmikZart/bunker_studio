import type { Metadata } from 'next';
import './globals.css';
import { PwaRegistration } from './pwa-registration';
import { AppShell } from './_components/app-shell';

export const metadata: Metadata = {
  title: 'Bunker Studio',
  description: 'Govern your persistent AI studio.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <PwaRegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
