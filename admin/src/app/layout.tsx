import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { Suspense } from 'react';
import { NavigationFeedback } from '../components/navigation/NavigationFeedback';
import { ThemeProvider } from '../components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'SISTEMA | Painel Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} font-sans`}>
        <ThemeProvider>
          <Suspense fallback={null}>
            <NavigationFeedback />
          </Suspense>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
