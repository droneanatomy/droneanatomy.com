import type { Metadata } from 'next';
import { Header, Footer } from '@/components';
import './globals.css';

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
    <html lang="en">
      <head>
        <link rel="preload" href="/videos/hero_vid.mp4" as="video" type="video/mp4" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
