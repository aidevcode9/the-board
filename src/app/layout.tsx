import { createAppMetadata } from '@/lib/branding/metadata';
import type { Metadata } from 'next';
import { Playfair_Display, Source_Serif_4, Space_Mono } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-playfair',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-source-serif',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = createAppMetadata(
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL,
);

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${playfair.variable} ${sourceSerif.variable} ${spaceMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
