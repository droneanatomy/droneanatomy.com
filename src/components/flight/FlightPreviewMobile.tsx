import Image from 'next/image';
import { SCENES } from './flightBeats';

/* ============================================================
   FlightPreviewMobile — the flight, as four stills.

   WHAT THIS REPLACES. On a phone the homepage does not mount three at
   all. FlightScene is a full-screen terrain with a 2048 shadow map, a
   tree field and two Draco airframes, scrubbed against 770vh of scroll;
   on a low-to-mid device it is the single reason the page stops keeping
   up. Skipping it takes the 560 KB three chunk, 3.5 MB of GLBs and
   1.5 MB of terrain off the wire with it — see LazyFlightPreview for
   where the decision is actually made, and gpuBudget for the 768px line.

   THE PICTURES ARE THE SCENE ITSELF, not artwork drawn to stand in for
   it: each one is a frame captured from the running beat at its settled
   camera, so the light, the fog and the airframe are the ones the
   desktop shows. scripts/build-scene-plates.mjs has the method and the
   crops. 407 KB for all seven plates on this page.

   THE COPY COMES FROM SCENES, the same array the desktop cards read. It
   is the whole reason this file is short: a beat renamed or reworded
   changes in one place and both renderings follow. Copying the four
   kickers and titles in here is how the phone ends up describing a
   product the desktop stopped selling two commits ago.

   NO SCROLL DRIVING ANYTHING. Four sections in normal flow, each a
   picture with its own words under it. The desktop's argument for
   scrubbing — that the camera move IS the content — does not survive a
   phone, where the same move costs a frame budget the device does not
   have and arrives on a screen too small to read it on.
   ============================================================ */

export const FlightPreviewMobile: React.FC = () => (
  <section aria-label="Flight" className="w-full bg-[#090b07] text-[#f2ecd9]">
    {SCENES.map((s, i) => (
      <article key={s.id} className="w-full">
        {/* 4:3, which is the shape the plates are cut to. Fixed by aspect
            rather than a dvh fraction: these sit in ordinary flow now, so
            the picture should not resize when the address bar collapses. */}
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            src={`/images/scenes/${s.id}.webp`}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            /* Only the first is eager. The rest are a screen or more down,
               and fetching all four up front on cellular is the payload
               mistake this whole change exists to avoid. */
            priority={i === 0}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </div>

        <div className="px-[var(--pad-x,5vw)] pb-[clamp(30px,9vw,54px)] pt-[clamp(18px,5vw,30px)]">
          <p className="font-display text-[clamp(10px,2.9vw,13px)] font-bold uppercase tracking-[0.14em] opacity-70">
            {s.kicker}
          </p>
          {/* The authored break is kept. Two of these titles carry one, and
              it is doing the same work here it does on the desktop card. */}
          <h2 className="mt-[clamp(10px,3vw,16px)] font-display text-[clamp(26px,7.6vw,40px)] uppercase leading-[1.02] tracking-[-0.02em]">
            {/* The trailing space is not stray. These spans are display:block,
                so the break costs no whitespace of its own — and without one
                the heading's TEXT CONTENT reads "Three aircraft,one command."
                to a screen reader while looking right on screen. InkHero's
                wordmark answers the same problem the same way. A space at the
                end of a block box is never painted, so nothing moves. */}
            {s.title.split('\n').map((line, k, all) => (
              <span key={k} className="block">
                {line}
                {k < all.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h2>
          <p className="mt-[clamp(12px,3.4vw,20px)] max-w-[42ch] text-[clamp(13px,3.6vw,17px)] leading-[1.5] opacity-75">
            {s.body}
          </p>
        </div>
      </article>
    ))}
  </section>
);

export default FlightPreviewMobile;
