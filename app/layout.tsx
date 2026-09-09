import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://tangrs77.github.io/lightwheel-business-card-studio/',
  ),
  title: 'Lightwheel Business Card Studio',
  description:
    'Generate template-perfect Lightwheel business cards and download a print-ready PDF.',
  openGraph: {
    title: 'Lightwheel Business Card Studio',
    description: 'Bilingual cards, ready as PDF.',
    images: [
      {
        url: 'https://tangrs77.github.io/lightwheel-business-card-studio/og.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lightwheel Business Card Studio',
    description: 'Bilingual cards, ready as PDF.',
    images: [
      'https://tangrs77.github.io/lightwheel-business-card-studio/og.png',
    ],
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
