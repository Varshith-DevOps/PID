import { AuthProvider } from '@/lib/authContext';
import './globals.css';

export const metadata = {
  title: 'NexusHR — Human Resource Management',
  description: 'Modern futuristic HR Management System with complete authentication, RBAC, and comprehensive HR modules',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#0a0e1a" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}