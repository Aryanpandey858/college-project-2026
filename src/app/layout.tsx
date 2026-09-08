/**
 * layout.tsx — Root Next.js layout
 * Sets dark theme, Inter + JetBrains Mono fonts, and SEO metadata.
 */
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SentinelAI — Real-Time Surveillance & Incident Detection',
  description:
    'Enterprise-grade AI surveillance platform with real-time combat, weapon, and vehicle collision detection powered by TensorFlow.js WebGL.',
  keywords: ['surveillance', 'AI', 'threat detection', 'TensorFlow', 'real-time', 'CCTV'],
  authors: [{ name: 'SentinelAI' }],
  robots: 'noindex, nofollow', // Private surveillance app — do not index
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090d16',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        {/* Preconnect to Google Fonts for fast font loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full w-full overflow-hidden bg-background text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
