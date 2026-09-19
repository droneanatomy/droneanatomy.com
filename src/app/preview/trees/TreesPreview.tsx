'use client';

/* The client half of /preview/trees: the section, plus the switch.

   The control is fixed to the viewport rather than placed in the flow
   because the section under it is a scroll timeline several viewports
   long — a control that scrolls away is useless for comparing two states
   of something you have to scroll through to see. */

import { useState } from 'react';
import dynamic from 'next/dynamic';

/* ssr:false for the same reason the homepage's wrapper does it: three
   must never run on the server. */
const FlightPreview = dynamic(
  () => import('@/components/flight/FlightPreview').then((m) => m.FlightPreview),
  { ssr: false }
);

export function TreesPreview() {
  const [on, setOn] = useState(true);

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 999,
          background: 'rgba(16,20,11,0.82)',
          backdropFilter: 'blur(8px)',
          color: '#f2ecd9',
          font: '600 12px/1 ui-monospace, monospace',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ opacity: 0.55 }}>Photoreal</span>
        <button
          type="button"
          onClick={() => setOn((v) => !v)}
          style={{
            cursor: 'pointer',
            border: '1px solid rgba(242,236,217,0.35)',
            background: on ? '#f2ecd9' : 'transparent',
            color: on ? '#10140b' : '#f2ecd9',
            borderRadius: 999,
            padding: '5px 14px',
            font: 'inherit',
            letterSpacing: 'inherit',
            textTransform: 'inherit',
          }}
        >
          {on ? 'On' : 'Off'}
        </button>
        <span style={{ opacity: 0.4, fontSize: 10 }}>rebuilds the scene</span>
      </div>

      {/* No key= here. FlightScene lists `photoreal` in its effect deps,
          so changing the prop tears the scene down and rebuilds it on its
          own — forcing a remount from outside would be the same job done
          twice, and less honestly. */}
      <FlightPreview photoreal={on} videoFirst />
    </>
  );
}

export default TreesPreview;
