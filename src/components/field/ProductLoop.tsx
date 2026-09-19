'use client';

/* ============================================================
   ProductLoop — a full-bleed looping film between the hero and the viewer.

   IT FOLLOWS THE VIEWER'S RULES, because it has to stand where the viewer
   used to stand. FieldHero's layers are position: fixed and stay pinned
   under everything that follows, so this is normal-flow content at z-20,
   the section itself TRANSPARENT, and a sticky viewport-sized stage that
   carries the ground and fades in. Ramping that one opacity dissolves the
   hero's last frame into the film instead of cutting to it — the same
   mechanism MiniViewer's header explains in full.

   IT OVERLAPS THE SECTION AFTER IT, and this is the part that is easy to
   break. The viewer is built the same way: transparent section, a stage
   that starts at opacity 0 and fades in over WHATEVER IS PINNED BEHIND IT.
   Stack this film above it end to end and, once the film scrolls away, the
   thing behind the viewer's half-faded stage is the hero again — its last
   frame flashes back between the film and the model.

   So the film's final viewport is shared. The section is 300vh and pulls
   the next section up by 100vh with a negative margin:

     film top at 0      the film has faded in and is pinned
     next 100vh         nothing overlaps; the film simply plays
     next 100vh         the viewer's top travels 100vh -> 0 and fades in
                        OVER the still-pinned film
     film bottom at vh  exactly when the viewer's top reaches 0, the
                        film's stage unpins — by then fully covered

   The arithmetic only holds if the NEXT section finishes its fade by the
   time its top reaches the viewport top. MiniViewer does (its FADE ends at
   an approach of 0.98). Put something after this that fades slower and
   the hero will show through again.

   THE STATEMENT ON THE FILM is the hero's void statement moved here: the
   same classes, the same anchors, and the same per-character entrance —
   the headline drops in from above with its glyphs lighting LAST to first,
   the paragraph rises from below lighting first to last. It is scrubbed
   rather than played, and it waits for the film: nothing lights until the
   stage has fully arrived (this section's top at the viewport top), and it
   is fully written half a viewport later, leaving the other half of the
   hold for reading before the viewer starts to dissolve over it. There is
   no exit sweep; the viewer covering the whole stage IS the exit.

   A SCRIM, because this film is not dark. Its reference is a black ground;
   this is mid-tone terrain, measured at 88-131 of 255 luma where the two
   blocks sit and brightest behind the paragraph. White holds at headline
   size over that, but a body paragraph over busy grass at under 4:1 does
   not, so the frame's two outer thirds are darkened toward the hero's
   ground and the type carries a dark halo. The centre third, where the
   aircraft is, is left almost untouched.

   PLAYBACK FOLLOWS VISIBILITY. Four seconds of 1080p decoded on a loop is
   not free, so the video plays only while its stage is showing and pauses
   once the viewer has covered it or it has scrolled back out above. It is
   never autoplayed under prefers-reduced-motion; the poster stands in.
   ============================================================ */

import { useEffect, useRef } from 'react';
import { gsap, SplitText } from '@/components/motion/gsap-setup';
import { clamp01, smoothstep, STATEMENT_CHAR_FADE } from './beats';
import type { ProductPage } from './product';

/* The hero's ground, so the dissolve lands on the colour the last frame
   already sits on. Same value as MiniViewer's. */
const GROUND = '#090b07';

/* The viewer's fade window, copied rather than imported because MiniViewer
   does not export it. Kept identical on purpose: the hero dissolves into
   both sections the same way, so they should arrive at the same pace. */
const FADE = [0.45, 0.98] as const;

/* The dark halo section 2's white copy uses, at the same two radii: a
   tight drop for the letter edges and a wide soft one for the ground the
   scrim does not fully quiet. */
const HALO = '0 1px 2px rgba(9,11,7,0.85), 0 0 18px rgba(9,11,7,0.6)';

export function ProductLoop({
  name,
  loop,
}: {
  name: string;
  loop: NonNullable<ProductPage['loop']>;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const video = videoRef.current;
    if (!section || !stage || !video) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    /* The statement's timeline and its scrub position. Kept apart because
       autoSplit REBUILDS the timeline on resize, and the new one has to be
       put back at wherever the reader already is. */
    const head = headRef.current;
    const body = bodyRef.current;
    const els = [head, body].filter(Boolean) as HTMLElement[];
    let story: gsap.core.Timeline | null = null;
    let storyP = reduced ? 1 : 0;
    const split = els.length
      ? SplitText.create(els, {
          type: 'chars,words',
          autoSplit: true,
          aria: 'auto',
          charsClass: 'da-char',
          onSplit: (self) => {
            const headChars = self.chars.filter((c) => head?.contains(c));
            const bodyChars = self.chars.filter((c) => body?.contains(c));
            const EACH = 0.012;
            story = gsap.timeline({ paused: true });
            if (head) {
              story
                .fromTo(head, { y: -26 }, { y: 0, duration: 0.7, ease: 'power2.out' }, 0)
                .fromTo(
                  headChars,
                  { opacity: 0 },
                  { opacity: 1, duration: STATEMENT_CHAR_FADE, ease: 'none', stagger: { each: EACH, from: 'end' } },
                  0
                );
            }
            if (body) {
              story
                .fromTo(body, { y: 26 }, { y: 0, duration: 0.7, ease: 'power2.out' }, 0)
                .fromTo(
                  bodyChars,
                  { opacity: 0 },
                  { opacity: 1, duration: STATEMENT_CHAR_FADE, ease: 'none', stagger: { each: EACH } },
                  0
                );
            }
            story.progress(storyP);
            return story;
          },
        })
      : null;

    const update = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const approach = 1 - Math.min(1, Math.max(0, r.top / vh));
      const fade = smoothstep(FADE[0], FADE[1], approach);
      stage.style.opacity = String(fade);

      /* 0 when this section's top reaches the viewport top — the stage has
         fully arrived by then — and 1 half a viewport later. */
      if (!reduced) {
        storyP = clamp01(-r.top / vh / 0.5);
        story?.progress(storyP);
      }

      /* Covered once the next section's top has reached the viewport top,
         which with the 100vh overlap is when this section's top is at
         -200vh. Gone once its bottom has left the top of the screen. */
      const covered = r.top <= -2 * vh;
      const showing = fade > 0.01 && !covered && r.bottom > 0;

      if (reduced) return;
      if (showing && video.paused) {
        /* play() rejects if the browser declines autoplay; the poster is
           already the right thing to show in that case, so swallow it. */
        video.play().catch(() => {});
      } else if (!showing && !video.paused) {
        video.pause();
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
      split?.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      /* z-20 and no background — see the header. The -100vh margin is the
         overlap that keeps the hero from showing between this and the
         viewer; it is not decoration and it is not optional. */
      className="relative z-20 h-[300vh]"
      style={{ marginBottom: '-100vh' }}
      aria-label={`${name} — in flight`}
    >
      <div
        ref={stageRef}
        className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: GROUND, opacity: 0 }}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          poster={loop.poster}
          muted
          loop
          playsInline
          /* metadata, not auto: the section sits below a 140-frame hero, and
             a 4 MB film should not compete with it for the first bytes. The
             first play() fetches the rest. */
          preload="metadata"
          aria-hidden="true"
        >
          {loop.webm && <source src={loop.webm} type="video/webm" />}
          <source src={loop.mp4} type="video/mp4" />
        </video>

        {/* The scrim — see the header. Outer thirds toward the ground,
            centre third nearly clear so the aircraft is not dimmed. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(9,11,7,0.62) 0%, rgba(9,11,7,0.38) 30%, rgba(9,11,7,0.08) 45%, rgba(9,11,7,0.08) 58%, rgba(9,11,7,0.42) 72%, rgba(9,11,7,0.66) 100%)',
          }}
        />

        {/* THE HERO'S STATEMENT CLASSES, copied rather than restyled, so
            the film's pair and the hero's pair are the same typographic
            object at every breakpoint. The anchors and the mobile
            arrangement are argued in full at the h2 in FieldHero. */}
        {loop.head && (
          <h2
            ref={headRef}
            className="absolute left-[8%] top-[18%] w-[84vw] translate-y-0 font-display text-[clamp(26px,10.7vw,72px)] uppercase leading-[0.93] tracking-[-0.02em] text-[#f2ecd9] md:left-[9%] md:top-1/2 md:w-auto md:-translate-y-1/2 md:text-[clamp(26px,3.75vw,72px)]"
            style={{ textShadow: HALO }}
          >
            {loop.head[0]}
            <br />
            {loop.head[1]}
          </h2>
        )}
        {loop.body && (
          <p
            ref={bodyRef}
            className="absolute bottom-[10%] left-1/2 w-[84vw] -translate-x-1/2 text-right text-[clamp(15px,1.77vw,34px)] leading-[1.42] text-[#f2ecd9] md:bottom-auto md:left-auto md:right-[8%] md:top-[42%] md:w-[clamp(230px,18.8vw,360px)] md:translate-x-0 md:text-left"
            style={{ textShadow: HALO }}
          >
            {loop.body}
          </p>
        )}
      </div>
    </section>
  );
}
