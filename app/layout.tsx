import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lightwheel Business Card Studio',
  description:
    'Generate template-perfect Lightwheel business cards and download a print-ready PDF.',
  openGraph: {
    title: 'Lightwheel Business Card Studio',
    description: 'Bilingual cards, ready as PDF.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lightwheel Business Card Studio',
    description: 'Bilingual cards, ready as PDF.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
