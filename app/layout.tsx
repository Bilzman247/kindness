import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'G-Squad',
  description: 'Mobile-exclusive real-time synthetic indices auto trading bot with risk management and automated execution.',
  openGraph: {
    title: 'G-Squad',
    description: 'Mobile-exclusive real-time synthetic indices auto trading bot with risk management and automated execution.',
    type: 'website',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'G-Squad',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-900 flex justify-center text-slate-900 antialiased selection:bg-blue-500 selection:text-white" suppressHydrationWarning>
        <div className="w-full max-w-md min-h-screen bg-slate-50 relative flex flex-col shadow-2xl overflow-x-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
