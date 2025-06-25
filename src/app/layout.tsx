
import type { Metadata } from 'next';
import './globals.css';
import { AppDataProvider } from '@/context/app-data-context';
import { AppLayout } from '@/components/layout/app-layout';
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from '@/context/auth-context'; // Added
import { RouteGuard } from '@/components/auth/with-auth'; // Added

export const metadata: Metadata = {
  title: 'DDO Toolkit',
  description: 'Your comprehensive companion for Dungeons & Dragons Online',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider> {/* Added AuthProvider */}
            <AppDataProvider>
              <RouteGuard> {/* Added RouteGuard */}
                <AppLayout>
                  {children}
                </AppLayout>
              </RouteGuard>
            </AppDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
