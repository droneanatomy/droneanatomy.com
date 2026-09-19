/* /fly — a hidden free-flight page. Nothing on the site links here.

   robots noindex: a secret that search engines list is not one. The game
   owns the viewport (FlyGame is fixed over everything and stops the
   document scrolling), so the route is in ChromeGate's OWN_NAV_ROUTES to
   keep the site nav from drawing on top of it. */

import { FlyGame } from '@/components/fly/FlyGame';

export const metadata = {
  title: 'Free flight | DroneAnatomy',
  description: 'Fly the fleet over the survey terrain.',
  robots: { index: false, follow: false },
};

export default function FlyPage() {
  return <FlyGame />;
}
