import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Anton, Fraunces } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fontMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const fontDisplay = Anton({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: '400',
});
const fontEditorial = Fraunces({
  subsets: ['latin'],
  variable: '--font-editorial',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Kabaddiadda — The home of Kabaddi',
    template: '%s · Kabaddiadda',
  },
  description:
    'Multitenant Kabaddi platform for tournaments, teams, players, and fans. Organise leagues, score live matches, and follow the action.',
  keywords: ['kabaddi', 'tournaments', 'live scoring', 'pro kabaddi', 'sports platform'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable} ${fontEditorial.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
