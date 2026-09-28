'use client';

import dynamic from 'next/dynamic';
import { usePhone } from '../usePhone';
import { TopoBlockMobile } from './TopoBlockMobile';

/* ssr:false so three never runs on the server, as with the other two. */
const TopoBlock = dynamic(() => import('./TopoBlock'), { ssr: false });

/* Gated here for the reason LazyFlightPreview spells out: a dynamic()
   chunk is fetched when the component renders, so the only way not to
   pay for it is not to render it. */
export const LazyTopoBlock: React.FC = () => {
  const phone = usePhone();
  if (phone === null) return null;
  return phone ? <TopoBlockMobile /> : <TopoBlock />;
};

export default LazyTopoBlock;
