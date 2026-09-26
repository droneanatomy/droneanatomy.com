import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { GoogleAnalytics } from '@next/third-parties/google';
import { HeaderGate, FooterGate } from '@/components/Chrome/ChromeGate';
import { BootCurtain } from '@/components/Chrome/BootCurtain';
import { OG_IMAGE, SITE_NAME, SITE_URL } from './site';
import './globals.css';

const robotoMono = localFont({
  src: '../../public/fonts/Roboto_Mono/RobotoMono-VariableFont_wght.ttf',
  variable: '--font-roboto-mono',
  display: 'swap',
});

/* METADATABASE IS THE LOAD-BEARING ONE. Without it Next resolves every
   relative url in this object — the canonical, the OG image, the twitter
   image — against nothing, and emits them as paths. A crawler reading
   `/images/og.jpg` as an OG url has no host to fetch it from, so the card
   comes back blank. With it, every relative url below becomes absolute at
   build time.

   The title is a TEMPLATE, so the eleven pages that set their own get
   "<theirs> | DroneAnatomy" without repeating the suffix, and the
   homepage keeps a written default rather than a bare brand name. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DroneAnatomy — autonomous systems for the next era of flight',
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'DroneAnatomy designs and builds autonomous aircraft in India — agricultural spraying, VTOL endurance, observation and compact platforms, with the controller, the sensors and the autonomy stack built in.',
  applicationName: SITE_NAME,
  keywords: [
    'drones',
    'UAV',
    'agricultural drone',
    'VTOL',
    'made in India drones',
    'autonomous aircraft',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    title: 'DroneAnatomy — autonomous systems for the next era of flight',
    description:
      'Autonomous aircraft designed and built in India. Agricultural spraying, VTOL endurance, observation and compact platforms.',
    locale: 'en_IN',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DroneAnatomy — autonomous systems for the next era of flight',
    description:
      'Autonomous aircraft designed and built in India. Agricultural spraying, VTOL endurance, observation and compact platforms.',
    images: [OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={robotoMono.variable}>
      <body>
        {/* Wraps the whole shell so any route can hold the curtain while
            its own assets land — see useBootGate. It renders its own
            overlay above these children, and the chrome with them. */}
        <BootCurtain>
          <HeaderGate />
          <main>{children}</main>
          <FooterGate />
        </BootCurtain>
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
