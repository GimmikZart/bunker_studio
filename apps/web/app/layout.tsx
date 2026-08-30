import type { Metadata } from 'next';
import './globals.css';
import { PwaRegistration } from './pwa-registration';

export const metadata: Metadata = {
  title: 'Bunker Studio',
  description: 'Govern your persistent AI studio.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
