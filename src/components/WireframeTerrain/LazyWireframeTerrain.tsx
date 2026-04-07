'use client';

import dynamic from 'next/dynamic';
import type { WireframeTerrainProps } from './WireframeTerrain';

const WireframeTerrain = dynamic(
    () => import('./WireframeTerrain'),
    { ssr: false }
);

export const LazyWireframeTerrain: React.FC<WireframeTerrainProps> = (props) => (
    <WireframeTerrain {...props} />
);
