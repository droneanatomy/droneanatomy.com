'use client';

import dynamic from 'next/dynamic';

/* ssr:false so three never runs on the server, as with the other two. */
const TopoBlock = dynamic(() => import('./TopoBlock'), { ssr: false });

export const LazyTopoBlock: React.FC = () => <TopoBlock />;

export default LazyTopoBlock;
