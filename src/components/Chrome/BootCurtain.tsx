'use client';

/* ============================================================
   BootCurtain — one opening screen for the whole site.

   This was the field hero's, and only that route had it. The counting
   curtain is the first thing anyone sees of this company, so having it
   on one product page and nowhere else made the rest of the site look
   like a different, plainer project.

   WHAT IT WAITS FOR IS THE WHOLE DESIGN. On the field hero it waited for
   one thing — the image sequence — because that route had exactly one
   slow asset. There is no such single asset site-wide, so instead:

     - a baseline every route gets for free: window load and fonts ready;
     - plus GATES, which any component can hold while its own assets are
       still arriving, via useBootGate.

   So the homepage can hold it for a texture and the field hero for its
   sequence, without this file knowing either of them exists.

   AND IT CANNOT STRAND THE PAGE. The version this came from carried a
   long comment warning that if the flag it waited on never flipped, the
   site would sit on its loading screen forever — a hazard that had
   already bitten once. A gate that never releases is now survivable:
   MAX_WAIT lifts the curtain regardless, and a route that hits it has a
   bug to fix rather than a site nobody can read.
   ============================================================ */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './BootCurtain.module.css';

/* The longest the curtain may ever hold. Generous enough that a slow
   connection finishes honestly, short enough that a stuck gate costs a
   visitor a few seconds rather than the page. */
const MAX_WAIT_MS = 9000;

/* Held after the count lands before the curtain moves. The two motions
   are strictly sequential — see the comment on the effect below. */
const HOLD_MS = 380;

/* Fallback teardown, for when transitionend never arrives (transition
   skipped, tab backgrounded). Longer than the CSS duration. */
const TRAVEL_FALLBACK_MS = 1600;

interface BootApi {
  /* Registers a gate. The returned function releases it, so it can be
     used directly as an effect's cleanup. */
  hold: () => () => void;
  /* Report real progress, 0..1. The curtain shows the furthest any gate
     has reported — it only ever climbs. */
  report: (fraction: number) => void;
}

const BootContext = createContext<BootApi | null>(null);

/* Holds the curtain while `pending` is true.

   Written so the effect's own cleanup IS the release: while pending, a
   gate is registered; the moment it flips, React tears the effect down
   and the gate goes with it. No release call to forget, and unmounting
   mid-load releases too — which matters, because a component that is
   removed while still loading would otherwise hold the curtain until
   MAX_WAIT. */
export function useBootGate(pending: boolean) {
  const api = useContext(BootContext);
  useEffect(() => {
    if (!api || !pending) return;
    return api.hold();
  }, [api, pending]);
}

/* Report load progress into the curtain's counter. Safe to call from a
   route that is not inside the provider — it becomes a no-op rather
   than throwing, so a component can be reused outside the site shell. */
export function useBootProgress() {
  const api = useContext(BootContext);
  return useCallback((f: number) => api?.report(f), [api]);
}

export const BootCurtain: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  /* Gate count in a ref, mirrored into state.

     The ref is what hold/release mutate, so registering never depends on
     a render having happened first — a gate held during the very first
     effect pass would otherwise race the provider's own state. */
  const gates = useRef(0);
  const [open, setOpen] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [counted, setCounted] = useState(false);
  const [curtainUp, setCurtainUp] = useState(false);
  const [lifted, setLifted] = useState(false);

  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const targetPct = useRef(0);
  /* Refs, not locals inside the tick effect. The effect re-runs when
     `ready` flips, and locals would reset the count to zero at the exact
     moment loading finishes — the counter would visibly fall back and
     start again. */
  const shownRef = useRef(0);
  const creepRef = useRef(0);

  const api = useMemo<BootApi>(
    () => ({
      hold: () => {
        gates.current += 1;
        setOpen(gates.current);
        let released = false;
        return () => {
          if (released) return;
          released = true;
          gates.current -= 1;
          setOpen(gates.current);
        };
      },
      report: (f: number) => {
        targetPct.current = Math.max(targetPct.current, Math.min(1, Math.max(0, f)));
      },
    }),
    []
  );

  /* The baseline. Fonts matter as much as bytes here: lifting before
     they swap means the first thing the visitor sees is the fallback
     face reflowing into the real one. */
  useEffect(() => {
    let done = false;
    const finish = () => { if (!done) { done = true; setLoaded(true); } };

    const waits: Promise<unknown>[] = [];
    if (document.readyState === 'complete') {
      waits.push(Promise.resolve());
    } else {
      waits.push(new Promise((r) => window.addEventListener('load', () => r(null), { once: true })));
    }
    if (document.fonts?.ready) waits.push(document.fonts.ready.catch(() => null));

    void Promise.all(waits).then(finish);
    const cap = setTimeout(finish, MAX_WAIT_MS);
    return () => clearTimeout(cap);
  }, []);

  /* The backstop, independent of everything above. */
  useEffect(() => {
    const t = setTimeout(() => {
      if (!lifted) { setCounted(true); setCurtainUp(true); }
    }, MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, [lifted]);

  const ready = loaded && open === 0;

  /* The counter is animated, not bound straight to bytes.

     A warm cache delivers everything in one go, so there are no
     intermediate progress events and a directly-bound counter reads 000
     and then 100. So it creeps forward on its own, capped at 92 until
     the page is genuinely ready, and eases to 100 only when it is.

     Written straight to the DOM rather than through state: this runs
     every frame, and re-rendering to move two digits would be absurd. */
  useEffect(() => {
    if (lifted) return;
    let raf = 0;
    const tick = () => {
      /* Asymptotic toward the 92% cap, so it decelerates as it goes
         rather than marching linearly. Advanced independently of the
         shown value — deriving the goal from it makes the easing
         throttle its own input, and the counter crawls. */
      creepRef.current += (0.92 - creepRef.current) * 0.02;
      const goal = ready ? 1 : Math.max(targetPct.current, creepRef.current);
      shownRef.current += (goal - shownRef.current) * (ready ? 0.2 : 0.12);
      if (ready && goal - shownRef.current < 0.002) shownRef.current = 1;
      const n = Math.round(shownRef.current * 100);
      if (countRef.current) countRef.current.textContent = String(n).padStart(3, '0');
      if (barRef.current) barRef.current.style.width = `${n}%`;
      if (shownRef.current === 1) { setCounted(true); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, lifted]);

  /* Strictly sequential: the curtain is gated on the COUNT reaching 100,
     not on a timer racing it. A timeout has to guess how long the run to
     100 takes, and when it guesses short the curtain is already
     travelling while the number is still in the eighties — the two
     motions overlap and neither resolves. */
  useEffect(() => {
    if (!counted) return;
    const t = setTimeout(() => setCurtainUp(true), HOLD_MS);
    return () => clearTimeout(t);
  }, [counted]);

  /* Unmount on transitionend, NOT on a timer. A timer has to guess the
     travel duration, and when it guesses short the curtain is removed
     mid-motion — it appears to climb halfway and then vanish. The
     fallback only exists in case the event never arrives. */
  useEffect(() => {
    if (!curtainUp) return;
    const t = setTimeout(() => setLifted(true), TRAVEL_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [curtainUp]);

  /* Announce the lift.

     Anything that wants to wait for a clear view can use these. The
     hero's drawn mark is the first customer: it draws itself on once the
     curtain is gone, gated purely in CSS off the attribute, because an
     animation played behind a full-screen overlay is one nobody sees.

     The ATTRIBUTE is the one in use; the event is here for anything
     imperative that needs the same signal. Both, rather than one,
     because an attribute suits components that mount after the lift —
     which is most of them — and an event suits those already running. */
  useEffect(() => {
    if (!lifted) return;
    document.documentElement.dataset.booted = 'true';
    window.dispatchEvent(new Event('boot:lifted'));
  }, [lifted]);

  /* Nothing behind the curtain should be scrollable while it is up —
     otherwise a scroll-driven page can be halfway through its timeline
     before anyone has seen the top of it. */
  useEffect(() => {
    if (lifted) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = prev; };
  }, [lifted]);

  return (
    <BootContext.Provider value={api}>
      {children}
      {!lifted && (
        <div
          className={`${styles.curtain} ${curtainUp ? styles.up : ''}`}
          /* Driven by a class that sets `transform`, not a `translate`
             utility. Tailwind v4's -translate-y-full sets the standalone
             `translate` property, so transitionend reports propertyName
             "translate" — a handler watching for "transform" never fires
             and the curtain can only be torn down by the fallback timer.
             Keeping it in `transform` keeps the property, the transition
             and the event name all in agreement. */
          onTransitionEnd={(e) => { if (e.propertyName === 'transform') setLifted(true); }}
          role="progressbar"
          aria-label="Loading"
          aria-live="polite"
        >
          <span ref={countRef} className={styles.count}>000</span>
          <span className={styles.track}>
            <span ref={barRef} className={styles.bar} />
          </span>
        </div>
      )}
      {/* Without JS the curtain is markup that never lifts, and the site
          is a blank dark rectangle. It renders server-side on purpose —
          that is what stops the page flashing through before hydration —
          so the no-JS case has to be answered here rather than by not
          rendering it.

          Raw HTML rather than JSX children: the browser does not parse
          inside a <noscript> when scripting is on, so React's serialised
          children and the live DOM disagree at hydration. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<style>.${styles.curtain}{display:none!important}</style>`,
        }}
      />
    </BootContext.Provider>
  );
};

export default BootCurtain;
