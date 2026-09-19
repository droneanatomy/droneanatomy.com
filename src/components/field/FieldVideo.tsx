'use client';

/* ============================================================
   FieldVideo — the lightbox behind the hero's PLAY card.

   The iframe is mounted ONLY while open, and that is the whole design.

   A YouTube embed left in the DOM costs a few hundred KB and a handful of
   requests on every visit, and this page is already asking the reader to
   wait on a decoded PNG sequence before it will scroll. Most readers never
   press play. So the embed does not exist until it is asked for, and
   unmounting on close is also what stops the audio — pausing a
   cross-origin iframe means talking to it over postMessage, while removing
   it is one line and cannot fail.

   The cost is that the video always starts from the beginning. That is the
   right trade for a product clip; it would be the wrong one for anything
   long enough to lose your place in.
   ============================================================ */

import React, { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  /** The bare YouTube id, not a URL. */
  id: string;
  title: string;
};

export const FieldVideo: React.FC<Props> = ({ open, onClose, id, title }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  /* Scroll lock, for the same reason FieldMenu carries one: everything
     behind this is a scrubbed ScrollTrigger timeline, so a wheel gesture
     over the lightbox would drive the hero's choreography underneath it.

     overflow:hidden on the documentElement rather than position:fixed on
     the body — the body technique re-anchors every position:fixed layer
     this hero is built from. */
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* Focus in on open, and back to whatever opened it on close. Remembering
     the trigger rather than assuming it is the PLAY card keeps this honest
     if the lightbox is ever opened from somewhere else. */
  useEffect(() => {
    if (open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      closeRef.current?.focus();
    } else if (returnTo.current) {
      returnTo.current.focus();
      returnTo.current = null;
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-[clamp(12px,4vw,48px)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* The backdrop is a button so it is a real click target with a real
          label, rather than a div with an onClick that nothing can reach
          except a mouse. */}
      <button
        type="button"
        aria-label="Close video"
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-[2px]"
      />

      {/* Sized to fit BOTH axes. 92vw caps it on a wide-short window and
          156vh caps it on a narrow-tall one: at 16:9 a box 156vh wide is
          about 88vh tall, which leaves the padding above and below intact.
          Constraining width alone lets a tall phone push the player past
          the bottom edge. */}
      <div className="relative w-[min(92vw,156vh)]">
        <div className="relative aspect-video w-full overflow-hidden rounded-[6px] border border-[#f2ecd9]/20 bg-black">
          <iframe
            /* nocookie, and autoplay because the reader has already made
               the choice by pressing PLAY — this is not a page-load
               autoplay. playsinline stops iOS taking the video fullscreen
               out from under the lightbox. */
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            className="absolute inset-0 size-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

      </div>

      {/* Anchored to the OVERLAY, not to the player.

          It sat above the player, which is only "above" while there is room
          above: at 16:9 the player nearly fills a short window, so on an
          853x396 frame the button landed at roughly y = -10 and was clipped
          off the top edge entirely. Escape and the backdrop still closed the
          lightbox, so nothing was trapped — but the only visible control was
          gone, which is the kind of thing that reads as broken.

          Pinned to the viewport corner it cannot be pushed anywhere. It
          overlaps the video on short windows, which is what the pill is
          for — the frame behind it is whatever the video happens to be
          showing, so it cannot rely on contrast it does not control. */}
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-[clamp(10px,2.2vw,28px)] top-[clamp(10px,2.2vw,28px)] z-10 rounded-full border border-[#f2ecd9]/25 bg-[#0e100f]/80 px-[clamp(10px,1.1vw,16px)] py-[clamp(6px,0.7vw,10px)] font-display text-[clamp(10px,0.82vw,14px)] font-bold uppercase tracking-[0.12em] text-[#f2ecd9] backdrop-blur-[2px] transition-opacity hover:opacity-70"
      >
        Close &times;
      </button>
    </div>
  );
};

export default FieldVideo;
