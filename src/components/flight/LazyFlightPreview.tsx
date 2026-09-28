'use client';

import dynamic from 'next/dynamic';
import { usePhone } from '../usePhone';
import { FlightPreviewMobile } from './FlightPreviewMobile';

/* ssr:false so three never runs on the server and stays off the server
   bundle — the same arrangement HeroCluster and InkHero use. */
const FlightPreview = dynamic(() => import('./FlightPreview'), { ssr: false });

/* WHERE THE PHONE DECISION IS MADE, and it has to be here rather than
   inside FlightPreview.

   dynamic() fetches its chunk when the component RENDERS. Not rendering
   it is therefore the only way to not download it — a check inside
   FlightPreview would run after three had already arrived, which is the
   560 KB this exists to avoid. Same for the 3.5 MB of Draco airframes
   and 1.5 MB of terrain the scene then asks for.

   null while usePhone is still deciding. That is one frame, and it is
   what this slot rendered on the server anyway. */
export const LazyFlightPreview: React.FC = () => {
  const phone = usePhone();
  if (phone === null) return null;
  return phone ? <FlightPreviewMobile /> : <FlightPreview />;
};

export default LazyFlightPreview;
