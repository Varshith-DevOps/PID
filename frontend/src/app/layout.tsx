import { AuthProvider } from '@/lib/authContext';
import { ToastProvider } from '@/lib/toastContext';
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/lib/themeContext';
import ForcePasswordChange from '@/components/ForcePasswordChange';
import ForceMfaSetup from '@/components/ForceMfaSetup';
import '../styles/tokens.css';
import './globals.css';

export const metadata = {
  title: 'PID hcms - People, Intelligence and Development',
  description: 'Human capital management system with authentication, RBAC, workforce intelligence, and core people operations.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#182B6D" />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              {children}
              <ForcePasswordChange />
              <ForceMfaSetup />
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
