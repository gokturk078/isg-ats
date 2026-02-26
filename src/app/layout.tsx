import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'İSG-ATS | İş Sağlığı ve Güvenliği Aksiyon Takip Sistemi',
  description:
    'İnşaat şantiyelerinde İSG denetçilerinin saha gözlemleri sonucu tespit ettiği tehlikeli durumların kayıt altına alındığı, takip edildiği ve kapatıldığı aksiyon takip sistemi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
