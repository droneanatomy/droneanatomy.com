'use client';

/* ============================================================
   EnquirySection — the page's closing beat.

   Lands on the ground the survey plate just left. Everything above this
   is rendered: ink, then flight, then a mountain turning into a map, and
   now the aircraft holding station over a lit deck while you write to
   us. The reference does exactly this with a vessel on a sea — the
   picture keeps running behind the words instead of stopping for them.

   That shot is FILMED now rather than rendered. It was the page's fourth
   WebGL context; it is a five-second loop, which leaves three renderers
   on the page and buys reflections and light no real-time budget here
   would have paid for.

   Composition follows the reference: copy centred in the upper half,
   craft below it, horizon between. Left-aligned type was tried first and
   it fought the scene, which is symmetrical about the centre line and
   pulls the eye there whatever the text does.

   The CTA is a REAL LINK to /contact that JavaScript intercepts. So it
   is crawlable, it survives JS failing, middle-click and "open in new
   tab" do the sensible thing — and with JS it opens the dialog in place
   instead of throwing away the page the visitor just scrolled through.
   ============================================================ */

import React, { useEffect, useRef, useState } from 'react';
import { EnquiryDialog } from './EnquiryDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import styles from './Enquiry.module.css';

const CONTACT_HREF = '/contact';
const PUBLIC_EMAIL = 'info@droneanatomy.com';

export const EnquirySection: React.FC = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  /* One reveal, then the observer is done. Nothing here is scrubbed —
     the three sections above already own the scroll, and a fourth thing
     tracking it would just be noise under the reader's eye. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      className={`home ${styles.root} ${shown ? styles.shown : ''}`}
      aria-labelledby="enquiry-head"
    >
      {/* THE CLOSING SHOT, FILMED. This was a fourth WebGL context —
          EnquiryScene, the aircraft holding station over a lit deck. It is
          now the Blender render of that same shot, which costs the page a
          renderer and gains it the lighting and reflections that were
          never going to survive in real time.

          A LOOP, not a scrub. "WATER V4": 119 frames at 24fps, 2560x1440
          at 17 Mbps as delivered, scaled to 1920 for the page. The 119->1
          wrap measures 7.55/255 mean luma against a median one-frame step
          of 6.78 and a largest of 7.43 — within the clip's own frame-to-
          frame noise, so the seam does not read as a cut. Nothing here
          reads scroll — the section's own note says the three above
          already own it.

          muted AND playsInline are both required or iOS refuses to
          autoplay and opens its fullscreen player instead. The poster
          carries the first frame so this is never a black rectangle. */}
      <video
        className={styles.canvas}
        poster="/video/enquiry-poster.jpg"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-hidden="true"
      >
        {/* A REAL MP4. The previous clip shipped as enquiry.mkv declared
            type="video/mp4" — Matroska wearing an MP4 label. Chrome sniffs
            the container and played it anyway; Safari trusts the type,
            cannot read Matroska, and showed only the poster. That is the
            one browser this site had just been checked on.

            h264, and still no VP9: the note that used to be here measured
            libvpx-vp9 flattening the previous shot's dark gradients, and
            this one has the same smooth sky.

            CRF 19, CHOSEN ON BLOCKINESS, NOT SSIM. The sky carries
            deliberate film grain, which is random per frame, so SSIM caps
            near 0.92 at every bitrate (crf 18 0.920, crf 24 0.907) and
            cannot separate the encodes. Measured instead over the grain
            itself, at three timestamps: fine-detail energy against the
            source, and the ratio of jumps across 8px block edges to jumps
            inside them (source 1.043). Every encode keeps the grain
            (1.005-1.031). Blockiness is what moves: crf 18 1.078 at 8.48
            MB, crf 19 1.085 at 7.64, crf 21 1.113 at 6.17, crf 24 1.142.
            x264's tune=grain was tried and is WORSE here — 1.141 at crf 20,
            1.208 at crf 23 — over-sharpening rather than preserving. */}
        <source src="/video/enquiry.mp4" type="video/mp4" />
      </video>
      <div className={styles.scrim} aria-hidden="true" />

      <div className={styles.inner}>
        <p className={styles.kicker}>Enquiries</p>

        <h2 id="enquiry-head" className={styles.head}>
          <span className={styles.line}>Indigenous by design.</span>
          <span className={styles.line}>
            From systems to missions.
          </span>
        </h2>

        <p className={styles.sub}>
          We design from failure -&gt; prevention -&gt; reliability.
        </p>

        <div className={styles.actions}>
          {/* WAS A 999px MONO PILL of its own. Same button as the product
              pages' now — the enquiry is the same kind of invitation, and
              two shapes for it only ever said that two people wrote them.
              The behaviour below is unchanged. */}
          <PrimaryButton
            href={CONTACT_HREF}
            onClick={(e) => {
              /* Let the browser have the modified clicks. Hijacking a
                 cmd-click into an in-page dialog is the kind of thing
                 that makes a site feel like it is fighting you. */
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              setOpen(true);
            }}
          >
            Start an enquiry
          </PrimaryButton>

          <p className={styles.direct}>
            or write to{' '}
            <a className={styles.link} href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a>
          </p>
        </div>
      </div>

      <EnquiryDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
};

export default EnquirySection;
