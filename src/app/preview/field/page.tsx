/* PREVIEW ROUTE — the field hero, at /preview/field.

   A second candidate hero, judged against the thermal-terrain hero on
   /preview. Deliberately standalone: it owns the whole viewport and
   runs its own scroll timeline, so it does not compose with the
   redesign's sections and must not be mounted inside HomeMotionProvider
   (ScrollSmoother would break its fixed layers). */

import { FieldHero } from '@/components/field/FieldHero';
import { P10_PRO } from '@/components/field/product';

export const metadata = {
  title: 'DroneAnatomy — Field Hero Preview',
  description: 'Scroll-driven 3D hero prototype for the P10 Pro.',
};

export default function FieldPreviewPage() {
  return <FieldHero product={P10_PRO} />;
}
