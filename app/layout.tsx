import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Asistente Personal | Control de Inventario',
  description: 'Gestiona tu despensa y controla las fechas de caducidad de tus productos.',
  keywords: 'inventario, caducidad, despensa, gestión de alimentos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#080810] text-white min-h-screen`}>
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
