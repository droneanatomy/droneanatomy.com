import Image from 'next/image';

/* ============================================================
   TopoBlockMobile — the survey, as the two frames that carry it.

   THE DESKTOP BEAT IS ONE CONTINUOUS MOVE: the massif in profile turns
   under the reader until it is directly overhead, and there it stops,
   read as a plan-view contour plate. The turn is the argument — "we
   know what's inside" is demonstrated by the mountain being taken
   apart, not asserted.

   A phone cannot have the turn, so it gets the two ends of it. The
   solid massif, then the same mountain as contours. Put one under the
   other and the reader makes the move themselves, which is the nearest
   a still can get to a scrub and is closer than a single frame of
   either end would be. Both are captured from the running scene at 25%
   and 85% through the beat — see scripts/build-scene-plates.mjs.

   That is also why the title is split across the two pictures rather
   than set above them: "We know," belongs to the mountain and "what's
   inside." belongs to the contours, which is exactly how the desktop
   times the two lines.
   ============================================================ */

/* Verbatim from TopoBlock. If the copy there changes it has to change
   here too — unlike the flight sections, there is no shared array to
   read from, because this beat's words live in its markup. */
const COORDS = ['28.6139° N', '77.2090° E'];
const COPY =
  'Most drone companies assemble. We started by taking them apart. Since 2015 we have serviced 12,000+ drones and documented 100+ ways they fail in the field, and every one of those lessons is built into our own. The flight controller, the sensors, the autonomy stack: we design what goes inside, not just the airframe around it. America has Skydio. China has DJI. India doesn’t yet. We’re building it.';

const PANELS = [
  { src: '/images/scenes/topo-massif.webp', line: 'We know,', caption: 'Elevation · 30 m profile' },
  { src: '/images/scenes/topo-contour.webp', line: 'what’s inside.', caption: 'Plan view · 1 m contour' },
];

export const TopoBlockMobile: React.FC = () => (
  <section aria-label="Survey" className="w-full bg-[#0a0908] text-[#f2ecd9]">
    <p className="flex gap-[clamp(10px,3vw,18px)] px-[var(--pad-x,5vw)] pt-[clamp(28px,8vw,48px)] font-mono text-[clamp(9px,2.6vw,12px)] uppercase tracking-[0.18em] opacity-60">
      {COORDS.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </p>

    {PANELS.map((p, i) => (
      <figure key={p.src} className="m-0 w-full">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image src={p.src} alt="" fill sizes="100vw" className="object-cover" loading="lazy" />
        </div>
        <figcaption className="px-[var(--pad-x,5vw)] pt-[clamp(12px,3.4vw,20px)]">
          <h2 className="font-display text-[clamp(28px,8.4vw,46px)] uppercase leading-[1.0] tracking-[-0.02em]">
            {p.line}
          </h2>
          <p className="mt-[clamp(8px,2.4vw,14px)] font-mono text-[clamp(9px,2.6vw,12px)] uppercase tracking-[0.18em] opacity-55">
            {p.caption}
          </p>
        </figcaption>
        {/* The paragraph rides under the SECOND picture only. It is the
            section's payload, and it belongs after the claim has been
            made rather than between the two halves of it. */}
        {i === 1 && (
          <p className="px-[var(--pad-x,5vw)] pb-[clamp(36px,10vw,64px)] pt-[clamp(16px,4.6vw,26px)] max-w-[46ch] text-[clamp(13px,3.6vw,17px)] leading-[1.55] opacity-75">
            {COPY}
          </p>
        )}
      </figure>
    ))}
  </section>
);

export default TopoBlockMobile;
