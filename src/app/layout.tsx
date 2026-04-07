import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Header, Footer } from '@/components';
import './globals.css';

const robotoMono = localFont({
  src: '../../public/fonts/Roboto_Mono/RobotoMono-VariableFont_wght.ttf',
  variable: '--font-roboto-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DroneAnatomy - Advanced Aerial Solutions',
  description:
    'DroneAnatomy provides cutting-edge drone technology for enterprise, commercial, and consumer applications. Explore our range of advanced aerial vehicles.',
  keywords: ['drones', 'aerial', 'UAV', 'drone technology', 'enterprise drones'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={robotoMono.variable}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
