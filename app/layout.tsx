import type { Metadata } from 'next';
import './globals.css';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://lightwheel-ai.github.io/lightwheel-business-card/',
  ),
  title: '自动生成名片 | Lightwheel',
  description:
    'Generate template-perfect Lightwheel business cards and save them as PDF or PNG.',
  openGraph: {
    title: '自动生成名片 | Lightwheel',
    description: 'Bilingual cards, ready as PDF or PNG.',
    images: [
      {
        url: 'https://lightwheel-ai.github.io/lightwheel-business-card/og.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '自动生成名片 | Lightwheel',
    description: 'Bilingual cards, ready as PDF or PNG.',
    images: ['https://lightwheel-ai.github.io/lightwheel-business-card/og.png'],
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
