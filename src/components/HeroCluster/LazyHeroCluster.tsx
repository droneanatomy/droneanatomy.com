'use client';

import dynamic from 'next/dynamic';
import type { HeroClusterProps } from './HeroCluster';

const HeroCluster = dynamic(() => import('./HeroCluster'), { ssr: false });

export const LazyHeroCluster: React.FC<HeroClusterProps> = (props) => (
  <HeroCluster {...props} />
);

export default LazyHeroCluster;
