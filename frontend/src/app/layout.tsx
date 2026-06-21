import { AuthProvider } from '@/lib/authContext';
import { ToastProvider } from '@/lib/toastContext';
import ForcePasswordChange from '@/components/ForcePasswordChange';
import './globals.css';

export const metadata = {
  title: 'PID hcms - People, Intelligence and Development',
  description: 'Human capital management system with authentication, RBAC, workforce intelligence, and core people operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#182B6D" />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider>
            {children}
            <ForcePasswordChange />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
