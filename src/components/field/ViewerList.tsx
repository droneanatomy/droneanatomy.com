'use client';

/* ============================================================
   ViewerList — the four features, over the render rather than beside it.

   OVER, because the panel's width is already solved against three limits at
   once (see the note on the shared width expression in MiniViewer) and
   putting a column beside it would have made the render narrower on every
   screen to buy space that is only needed on wide ones. The scrim is what
   makes it legible; the reference does the same thing.

   A ROW WITHOUT COPY IS NOT AN EMPTY ROW. It renders as a plain label with
   no '+' and no expansion, because a disclosure control that discloses
   nothing is a lie. That is what lets these four ship on names alone and
   gain a sentence later as a data edit rather than a code change.

   ON NARROW SCREENS IT STOPS BEING AN OVERLAY. Below the `sm` breakpoint it
   returns to normal flow underneath the render: a 46% column over a panel
   that is already only as wide as a phone would leave the aircraft in a
   letterbox slot, and the dots would sit under the copy.
   ============================================================ */

import type { ViewerHotspot } from './product';

type Props = {
  hotspots: ViewerHotspot[];
  selected: number | null;
  onSelect: (i: number | null) => void;
};

export function ViewerList({ hotspots, selected, onSelect }: Props) {
  const step = (dir: 1 | -1) => {
    const n = hotspots.length;
    if (!n) return;
    /* From nothing, forward starts at the first and back at the last. */
    const from = selected ?? (dir === 1 ? -1 : 0);
    onSelect((from + dir + n) % n);
  };

  return (
    <div
      className={
        'pointer-events-none absolute inset-y-0 right-0 flex w-[min(46%,320px)] flex-col ' +
        'justify-center gap-3 px-[clamp(12px,2.2vw,28px)] ' +
        'max-sm:static max-sm:w-full max-sm:px-0 max-sm:pt-5'
      }
    >
      {/* THE SCRIM, on its own element rather than as a background on the
          column. The column is a flex box whose height is the list's; the
          scrim has to span the panel's full height to fade out against its
          edges, and a background would have been clipped to the rows.
          Hidden on narrow screens, where the list is not over anything. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-16 right-0 max-sm:hidden"
        style={{
          background:
            'linear-gradient(to right, rgba(9,11,7,0) 0%, rgba(9,11,7,0.55) 42%, rgba(9,11,7,0.78) 100%)',
        }}
      />

      <ol className="pointer-events-auto relative m-0 list-none p-0">
        {hotspots.map((h, i) => {
          const open = selected === i;
          return (
            <li key={h.label} className="border-b border-[rgba(242,236,217,0.14)]">
              <button
                type="button"
                onClick={() => onSelect(open ? null : i)}
                aria-expanded={h.body ? open : undefined}
                className={
                  'flex w-full items-baseline gap-3 py-2.5 text-left transition-colors duration-200 ' +
                  (open ? 'text-[#f2ecd9]' : 'text-[rgba(242,236,217,0.62)] hover:text-[#f2ecd9]')
                }
              >
                <span className="font-display text-[10px] tabular-nums opacity-60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 font-display text-[clamp(10px,0.82vw,13px)] font-bold uppercase tracking-[0.12em]">
                  {h.label}
                </span>
                {h.body && (
                  <span aria-hidden className="font-display text-[13px] leading-none opacity-60">
                    {open ? '−' : '+'}
                  </span>
                )}
              </button>

              {h.body && (
                /* Animated on a grid row rather than on height, so the copy
                   never needs a measured pixel value and the row can be
                   edited without retuning the transition. */
                <div
                  className="grid transition-[grid-template-rows] duration-300"
                  style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-3 text-[clamp(11px,0.78vw,13px)] leading-relaxed text-[rgba(242,236,217,0.72)]">
                      {h.body}
                    </p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="pointer-events-auto relative flex justify-end gap-2 pt-1">
        {([-1, 1] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => step(dir)}
            aria-label={dir === 1 ? 'Next feature' : 'Previous feature'}
            className={
              'flex size-8 items-center justify-center rounded-full border ' +
              'border-[rgba(242,236,217,0.28)] text-[#f2ecd9] transition-colors duration-200 ' +
              'hover:border-[rgba(242,236,217,0.7)]'
            }
          >
            <span aria-hidden className="text-[13px] leading-none">
              {dir === 1 ? '→' : '←'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ViewerList;
