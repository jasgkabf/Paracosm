import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: [
    { path: '../fonts/Inter-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Inter-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/Inter-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/Inter-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: [
    { path: '../fonts/JetBrainsMono-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/JetBrainsMono-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/JetBrainsMono-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Paracosm',
  description: 'Multi-agent AI orchestration framework',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-paracosm-dark text-paracosm-text`}
      >
        {children}
      </body>
    </html>
  );
}
