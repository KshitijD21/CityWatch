import type { Metadata } from 'next';
import {
  Inter,
  Geist_Mono,
  DM_Serif_Display,
  Dancing_Script,
} from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const dmSerif = DM_Serif_Display({
  variable: '--font-heading',
  weight: '400',
  subsets: ['latin'],
});

const dancingScript = Dancing_Script({
  variable: '--font-accent',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CityWatch — Know before you go',
  description:
    'Real-time safety awareness with live maps, AI briefs, and community reporting.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} ${dmSerif.variable} ${dancingScript.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
