/* PREVIEW ROUTE — the scroll-driven flight, at /preview/flight.

   Standalone and unlinked, the same way /preview/p10 is. It owns the
   viewport, runs its own scroll listener and mounts a second WebGL
   context, none of which should be near the homepage while the
   choreography is still being judged.

   Everything you see is PLACEHOLDER GEOMETRY. The aircraft are built
   from primitives at the real airframes' proportions and the farmland is
   generated. That is the point: the camera legs, the scene pacing and the
   formation spacing are what need signing off, and none of them get
   better because the mesh did. Real GLBs swap in behind craft.ts and
   terrain.ts without touching the choreography. */

import { LazyFlightPreview } from '@/components/flight/LazyFlightPreview';

export const metadata = {
  title: 'DroneAnatomy — Flight Preview',
  description: 'Scroll-driven VTOL flight over farmland. Placeholder geometry.',
};

export default function FlightPreviewPage() {
  return <LazyFlightPreview />;
}
