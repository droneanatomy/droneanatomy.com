'use client';

import dynamic from 'next/dynamic';

/* ssr:false so three never runs on the server and stays off the server
   bundle — the same arrangement HeroCluster and InkHero use. */
const FlightPreview = dynamic(() => import('./FlightPreview'), { ssr: false });

export const LazyFlightPreview: React.FC = () => <FlightPreview />;

export default LazyFlightPreview;
