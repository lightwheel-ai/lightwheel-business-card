import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  metadataBase: new URL('https://lwtool0.github.io/lightwheel-business-card/'),
  title: 'Lightwheel Business Card',
  description:
    'Generate template-perfect Lightwheel business cards and download a print-ready PDF.',
  openGraph: {
    title: 'Lightwheel Business Card',
    description: 'Bilingual cards, ready as PDF.',
    images: [
      {
        url: 'https://lwtool0.github.io/lightwheel-business-card/og.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lightwheel Business Card',
    description: 'Bilingual cards, ready as PDF.',
    images: ['https://lwtool0.github.io/lightwheel-business-card/og.png'],
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
