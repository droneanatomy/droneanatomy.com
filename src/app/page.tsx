import { LazyInkHero } from '@/components/InkHero/LazyInkHero';
import { LazyFlightPreview } from '@/components/flight/LazyFlightPreview';
import { LazyTopoBlock } from '@/components/topo/LazyTopoBlock';
import { EnquirySection } from '@/components/enquiry/EnquirySection';

export const metadata = {
  title: 'DroneAnatomy - Advanced Aerial Solutions',
  description:
    'DroneAnatomy provides cutting-edge drone technology for enterprise, commercial, and consumer applications.',
};

/* The light scheme is the hero. The dark one that sat above this for
   comparison is gone; InkHero still supports scheme="dark" if it is ever
   wanted again, and its blend source is derived and documented there.

   Both `scheme` and `inkDepth` are left at their defaults ('light', 0.06)
   rather than passed explicitly — the defaults ARE this design, and
   restating them here would mean two places to change. */
export default function Home() {
  return (
    <>
      {/* The sentence breaks after "Autonomous" now, so the small prefix
          carries two words and the headline carries the other two. No
          `trail`: "Inevitable" moved up into the wordmark, which leaves the
          lockup two parts instead of three. The prop is still supported —
          InkHero guards it — it simply has nothing to hold.

          CHANGING `wordmark` MEANS RE-MEASURING --mark-em in
          InkHero.module.css. The font size is derived from it, so a stale
          value silently leaves the line too small or too wide for its
          measure; the note there has the method. */}
      <LazyInkHero
        lead="Making Autonomous"
        wordmark="Flight Inevitable"
        tagline="We build the autonomous systems that define the next era of flight."
        imageSrc="/images/vtol.jpg"
      />

      {/* The flight, below the hero. It pins itself via a sticky stage
          rather than a fixed canvas, so it occupies exactly its own
          8.5 screens and neither the hero above nor the footer below is
          painted over.

          Two WebGL contexts now live on this page. Both gate their render
          loops on an IntersectionObserver, so only the one on screen is
          actually drawing — but it is worth knowing they are both here
          before adding a third. */}
      <LazyFlightPreview />

      {/* The survey. One continuous scrubbed move from a low profile of
          the massif to directly overhead, where it becomes a plan-view
          plate — and it stops there, which is the whole beat.

          SCRUBBED, unlike the flight above it. The flight cuts between
          set pieces on a trigger; this is one move the viewer drives, and
          feeling the mountain turn under them is the point. Two different
          scroll models on one page is deliberate, not an inconsistency.

          Third WebGL context on this page. All three gate their render
          loops on an IntersectionObserver so only the on-screen one
          draws, but three is the practical ceiling — a fourth wants a
          shared renderer instead. */}
      <LazyTopoBlock />

      {/* The full stop. Type only — no fourth WebGL context, and none
          wanted: after ink, flight and a mountain becoming a map, the
          useful thing at the bottom of the page is a way to talk to
          someone. It keeps the survey's ground so the plate above reads
          as having been set down on it.

          Not lazy, unlike the three above. There is no renderer to keep
          off the server and it is the page's conversion point, so it
          server-renders and stays crawlable. */}
      <EnquirySection />
    </>
  );
}
