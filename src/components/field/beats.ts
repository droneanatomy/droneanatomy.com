/* ============================================================
   Shared beat maths for the field hero.

   Its own module, deliberately. FieldHero needs these numbers, but
   FieldScene is a dynamic ssr:false import and must stay out of the main
   bundle — importing a constant from it would drag Three.js in with it.

   VOID_WINDOW is the one number that genuinely must agree in both places:
   the DOM fades the photographic plate across it, and the scene crosses its
   lighting from daylight to void across it. If they drift, the world stays
   lit after the photograph has gone.
   ============================================================ */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---- The acts, and their clocks ----------------------------------------
   Each act owns its own 0..1 clock. Every window in this file is a fraction
   of ITS ACT, never of the page, and FieldHero divides the raw scroll into
   three numbers before applying anything.

   The acts are declared in VIEWPORT HEIGHTS and the fractions are derived
   from them, which is the whole point. Authoring the fractions directly —
   as this did twice — means every existing beat silently changes length the
   moment a new section is appended, and the only fix is to multiply twenty
   tuned constants by a correction factor and rewrite the comments quoting
   them. Declared in vh, adding a section is one number: every earlier act
   keeps its exact absolute scroll length, automatically.

   So: to add act four, add its vh and give it a start and a span. Nothing
   above it moves. */
/* Act one is longer than the others because it carries the rendered
   sequence, and a sequence has a scroll-per-frame ratio that the rest of
   the page does not.

   110 frames across 950vh is 8.6vh a frame — about 68px on a typical
   window, so a wheel notch advances a little under two frames.

   The export holds 160. Only 10-119 are act one — the first ten are cut,
   and 120-159 are act four's return. The cut removed the move's slow ease
   in: frames 0-9 travel 0.4 to 1.0px each against a 1.26px mean, so they
   read as hesitation before the shot starts rather than as part of it.

   It costs the loop. Act four's last frame lands exactly on source frame 0,
   which used to be where act one began — 0.00px apart, measured. Against
   the new start it is 8.14px, about eight frames of travel. That only shows
   to a reader who runs from the very bottom back to the very top, and it
   was worth the trade, but it is no longer seamless and nothing in the code
   will warn you.

   Notches-per-frame is only ever a proxy, and it has now gone the wrong way
   twice while the result improved both times — first from 66 frames to 120,
   now from 120 to 110. What the eye judges is how far the PICTURE moves per
   notch, not how many frames it crosses. Mean travel between neighbours is
   1.26px at this export against 60px at the 66-frame cut, so a notch that
   spans two frames here moves less of the image than one frame did then.

   To re-derive after a new export: viewport_px / (ACT_ONE_VH / (frames-1))
   is the notches per frame, and one is a good place to sit. More frames
   from the render means this can come back down. */
/* ---- Composing a page out of acts --------------------------------------
   The four acts below are P10 Pro's arrangement, not the only one. Other
   product pages reuse some of these and not others — a page with no gallery,
   or with the bench before the gallery — and that has to be expressible
   without forking the timeline.

   So a page declares an ACT LIST and the spans are derived from it. The vh
   numbers stay here because they are choreography: how much scroll a beat
   needs is a property of the beat, not of the product. What a page chooses
   is WHICH beats it has and in what order.

   This is the same principle the act lengths already followed — declare in
   vh, derive the fractions — extended one level up. Adding, removing or
   reordering an act is now a change to one array, and every act that
   remains keeps its exact absolute scroll length. */
export type ActKind = 'hero' | 'gallery' | 'bench' | 'closing';
export type ActSpec = { kind: ActKind; vh: number };

export type ActClock = { start: number; span: number };

/* Returns the page's total height and, for each act present, where it
   starts and how long it runs — both as fractions of the whole scroll.

   Acts NOT in the list are simply absent from the map, and every consumer
   has to handle that. That is deliberate: an optional act whose clock
   silently reads 0 would run its beats at the top of the page rather than
   not at all, which is a much harder failure to see. */
export const deriveActs = (acts: readonly ActSpec[]) => {
  const spacerVh = acts.reduce((total, a) => total + a.vh, 0);
  const clock = {} as Partial<Record<ActKind, ActClock>>;
  let acc = 0;
  for (const a of acts) {
    clock[a.kind] = { start: acc / spacerVh, span: a.vh / spacerVh };
    acc += a.vh;
  }
  return { spacerVh, clock };
};

/* One wheel notch, in CSS pixels.

   Chrome on Windows and Linux sends 100px per detent. A trackpad is
   continuous and has no notch at all, so this is the COARSEST input the
   page has to serve rather than a universal — and the coarsest input is
   the one that decides whether a frame gets skipped. */
export const SCROLL_NOTCH_PX = 100;

/* A scrubbed act's length, SOLVED from its frame count rather than typed.
   Used for act one and for act four's return — both are png sequences and
   both should advance one frame per notch.

   950vh was a number chosen by feel, and at 110 frames it worked out to
   about 78px of scroll per frame on a 900px window. One notch is 100px, so
   a single detent advanced 1.3 frames and the sequence visibly skipped —
   the stepping is a SAMPLING problem, and no amount of easing fixes a
   sample rate that is too low.

   Solving the other way round — how long does the act have to be for one
   notch to advance exactly one frame — gives 109 intervals x 100px, or
   about 1211vh at that same window. Longer, not shorter, which is the
   counter-intuitive part: more scroll per frame is what makes it smooth.

   frames - 1 because that is the number of INTERVALS between frames, which
   is what setProgress maps across; using `frames` would leave the last one
   a notch short.

   Note the tension this carries: the result is in vh, so it is only exactly
   1:1 at the viewport height it was solved for. FieldHero fixes it at mount
   and does not re-solve on resize, because changing the spacer mid-scroll
   would jump the timeline under the reader — a worse fault than a slightly
   off ratio after a window drag. */
/* WHAT ONE vh IS WORTH, IN PIXELS, measured rather than assumed.

   scrubVhForFrames below turns a PIXEL target into a vh number, and that
   number is then rendered as a vh height. The two have to be the same
   idea of a viewport or the act comes out the wrong length — and on a
   phone they are not. `vh` is the LARGE viewport, the one with the
   address bar scrolled away; window.innerHeight is whatever the bar is
   doing at the moment it is read, usually the small one on first load.
   Solve against innerHeight and the spacer renders 15-25% longer than
   the frames asked for: every notch advances less than a frame, the
   whole act drags, and the tail is scroll nobody authored.

   On a desktop the two agree exactly, which is why this was invisible —
   measured on the Cyclops page, a 140-frame act solved to 13891px
   against a 13900px target.

   A probe rather than documentElement.clientHeight: clientHeight is the
   layout viewport, which is close but is not what the vh unit is defined
   against, and the whole point here is to ask the browser what it means
   by vh rather than to model it. */
export const vhInPx = (): number => {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  /* innerHeight is the fallback, which is what this used to pass always. */
  return h || window.innerHeight;
};

export const scrubVhForFrames = (
  frames: number,
  viewportPx: number,
  pxPerFrame: number = SCROLL_NOTCH_PX
) => Math.round(((frames - 1) * pxPerFrame * 100) / Math.max(1, viewportPx));

/* EXPORTED, unlike its three siblings, because a page can legitimately
   consist of act one and nothing else — /products/mini is one — and such a
   page has to name this length without restating it. Restating it is the
   precise failure the note on DEFAULT_ACTS below describes: act four's vh
   was changed in one place and not the other, and the edit silently did
   nothing. If another act ever becomes independently selectable, export it
   here rather than copying its number into a product. */
export const ACT_ONE_VH = 950; // grass, void, the rendered sequence, statement, coda, slide
const ACT_TWO_VH = 620; // the aircraft leaves, the lockup lands, the gallery runs
/* 720 until the bench footnote went. That left 86vh between the last
   panel leaving at 0.70 and the end card starting at 0.82 with nothing in
   it — see the END_FROM note in FieldBench, which is where the 0.82 came
   from and why it outlived its reason. Trimmed by exactly that; the
   panels and the end card keep the absolute lengths they had. */
const ACT_THREE_VH = 634; // the bench
/* Act four: the aircraft returns, lands where it started, and the page
   makes its closing ask.

   40 frames, and the act is deliberately much longer than they need. They
   run at act one's density — one frame per notch, the ratio the
   wheel is tuned to, so 316vh — and everything after that is the plate
   coming back, the closing card arriving, and holding room.

   The holding room is load-bearing, not padding. This is the last act on
   the page and a scrub's tail is asymptotic: anything keyed near 1.0 is
   only reached by coming to rest at the very bottom. At 250vh the plate's
   return landed in the final 1.6% of the document and never arrived at all
   while scrolling.

   620 fixed that and then overcorrected: everything visible finished by
   0.72 of the act and the remaining 174vh was scrolling past a page with
   nothing left to do. 500 keeps the reachability and returns the rest —
   see returnClock for what the tail is still for. */
const ACT_FOUR_VH = 500; // the return, and the closing card

export const SPACER_VH = ACT_ONE_VH + ACT_TWO_VH + ACT_THREE_VH + ACT_FOUR_VH;

export const ACT_ONE_SPAN = ACT_ONE_VH / SPACER_VH;
export const ACT_TWO_START = ACT_ONE_SPAN;
export const ACT_TWO_SPAN = ACT_TWO_VH / SPACER_VH;
export const ACT_THREE_START = ACT_TWO_START + ACT_TWO_SPAN;
export const ACT_THREE_SPAN = ACT_THREE_VH / SPACER_VH;
export const ACT_FOUR_START = ACT_THREE_START + ACT_THREE_SPAN;
export const ACT_FOUR_SPAN = ACT_FOUR_VH / SPACER_VH;

/* P10 Pro's arrangement, and the default for a page that does not say.

   Built FROM the constants above rather than restating their numbers. It
   used to restate them, and they drifted the first time one moved: act four
   was cut from 620 to 500 in ACT_FOUR_VH while this list still said 620, so
   the page kept its old length and the edit silently did nothing. The beat
   windows had already been rescaled for the shorter act, so the two halves
   of the change disagreed — the kind of fault that looks like the code
   ignoring you. Derived, it cannot happen.

   Declared AFTER the constants because a const cannot be read before its
   own declaration. Moving this back above them throws at module init rather
   than failing quietly, which is the better of the two outcomes. */
export const DEFAULT_ACTS: readonly ActSpec[] = [
  { kind: 'hero', vh: ACT_ONE_VH },
  { kind: 'gallery', vh: ACT_TWO_VH },
  { kind: 'bench', vh: ACT_THREE_VH },
  { kind: 'closing', vh: ACT_FOUR_VH },
];

/* ---- Act four: the return ----------------------------------------------
   The page closes where it opened. The end sequence flies the aircraft back
   down to the exact pose act one starts from, and the photographic plate
   comes back under it.

   The plate waits for the BAG. The sequence drops the payload bag out of
   frame across its middle, and that is read off the export rather than
   guessed: alpha coverage sits flat at 4.9% for frames 0-8, swells to 10%
   as the bag enters and its bounding box stretches from 51px tall to 143,
   then the box drops back to 50 at frame 25, where the bag has gone and
   only the aircraft is left.

   Starting earlier — this was 0.08 of the act — fades the field up THROUGH
   the falling bag, which puts a photograph behind an object that is still
   leaving and reads as two shots dissolved together rather than one
   continuous one. The ground now arrives on a frame with the aircraft
   alone in it.

   The cost is that the plate no longer precedes the landing. Worth it: a
   bag crossing a fading photograph is a much louder mistake than a ground
   that arrives late, and if the arrival wants more room the answer is more
   scroll after frame 25, not an earlier fade.

   RETURN_CARD is the P10 Pro card leaving. It goes first and fast: it is a
   title over black, and a title still dissolving while anything fades up
   through it muddies both. */
/* ---- Act four's clock, SOLVED like act one's -----------------------------

   The return sequence now runs at act one's density: 100px per frame, the
   coarsest scroll gesture advancing exactly one frame. It used to be 316vh
   over 39 intervals — 7.9vh a frame — which matched act one back when act
   one was 950vh and stopped matching the moment act one was solved. The
   closing animation was the coarser of the two and stepped where the
   opening did not.

   Because the sequence's length is now solved per viewport, act four's
   TOTAL length moves with it, and anything expressed as a fraction of the
   act would slide around underneath. So everything after the sequence is
   held as an absolute distance in vh from the moment the sequence ends,
   and the fractions are computed at the end. Values carried over from the
   tuned 500vh act, where the sequence ended at 316vh:

     plate finishes   341.0 - 316.0 =  25.0
     CTA starts       347.2 - 316.0 =  31.0
     CTA ends         446.5 - 316.0 = 130.5
     settle after it                    53.5   (see below)

   RETURN_CARD is the P10 Pro card leaving — first and fast, so the title is
   gone before anything fades up through it. 34vh from the act's start.

   PLATE's start is keyed to sequence FRAME 24 of 40, the last one with the
   bag still in shot: its bounding box drops from 142px tall to 50 at frame
   25. 24/39 = 0.615 of the sequence. Starting on 24 rather than 25 overlaps
   the bag's last moment by design — the ground begins arriving as the bag
   clears rather than after it, so the two read as one movement.

   The 53.5vh settle is the last thing on the page and is deliberately not
   smaller. A scrub's tail is asymptotic: the card has to finish while the
   reader is still moving, not only once they come to rest at the bottom.
   Half a screen at scrub: 1 is roughly the lag itself, so it lands as the
   footer appears rather than after it. It used to be 173.6vh — nearly two
   screens of scrolling past a finished page — which read as the page having
   ended before it stopped. */
export const RETURN_AFTER_SEQ_VH = {
  plateEnd: 25.0,
  ctaStart: 31.0,
  ctaEnd: 130.5,
  settle: 53.5,
};
export const RETURN_CARD_VH = 34;
/** Frame 24 of 39 intervals — the last frame with the payload bag in shot. */
export const RETURN_BAG_CLEARS = 24 / 39;

export type ReturnClock = {
  actVh: number;
  SEQ: readonly [number, number];
  CARD: readonly [number, number];
  PLATE: readonly [number, number];
  CTA: readonly [number, number];
};

export const returnClock = (seqVh: number): ReturnClock => {
  const A = RETURN_AFTER_SEQ_VH;
  const actVh = seqVh + A.ctaEnd + A.settle;
  const f = (vh: number) => vh / actVh;
  return {
    actVh,
    SEQ: [0, f(seqVh)],
    CARD: [0, f(RETURN_CARD_VH)],
    PLATE: [f(seqVh * RETURN_BAG_CLEARS), f(seqVh + A.plateEnd)],
    CTA: [f(seqVh + A.ctaStart), f(seqVh + A.ctaEnd)],
  };
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;


export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* The plate leaves in two stages rather than one fade.

   First it simply loses light across DIM_WINDOW — a couple of scroll notches
   where the courtyard is still legible, just darker, as though the sun were
   going out of it. Then it switches to black across BLACK_WINDOW, which is
   deliberately short: a long opacity fade to black reads as a layer being
   turned off, a quick one reads as a cut to night.

   BLACK_WINDOW[1] == INTRO_WINDOW[1] == LIFT_WINDOW[1]. The world finishes
   going out on the same frame the last of the first-screen copy finishes
   hiding, and the aircraft stops climbing there too. Anything later and the
   plate carries on darkening over a frame that has already emptied. */
export const DIM_WINDOW: readonly [number, number] = [0.015, 0.065];
/* Brightness left at the end of the dim stage. Not near zero — the switch
   has to have something left to take away. */
export const DIM_FLOOR = 0.32;
export const BLACK_WINDOW: readonly [number, number] = [0.065, 0.09];

/* The scene's own daylight-to-void crossing. Spans both plate stages so the
   render never disagrees with the photograph behind it. */
export const VOID_WINDOW: readonly [number, number] = [0.03, 0.09];

/* ---- Beat 0 exits -------------------------------------------------------
   Every one of these is keyed to the plate leaving, so they all have to move
   together when BLACK_WINDOW does. They live here rather than inline in
   FieldHero precisely because they are coupled: scattered as literals, a
   change to the time-to-black silently leaves them behind and the corner copy
   is still fading out over a void it no longer belongs to.

   Ordering is deliberate — smallest type leaves first, largest body copy
   last, so the frame empties rather than cutting. */
export const KICKER_WINDOW: readonly [number, number] = [0.01, 0.06];
export const CARD_WINDOW: readonly [number, number] = [0.015, 0.07];
export const PARA_WINDOW: readonly [number, number] = [0.02, 0.08];
export const INTRO_WINDOW: readonly [number, number] = [0.025, 0.09];

/* The model tab, and the last of the corner furniture to go.

   Last on purpose, which is the same ordering rule the four above follow,
   read one step further. That rule is about VISUAL MASS, not literally about
   type size — the tab is 9px type, so by character size it would leave
   first, but it is set on a solid #f2ecd9 panel and is the only inverted
   element on the page. It is the heaviest thing in that corner by some
   distance, and a frame empties correctly when the heaviest mark is the last
   one lifted.

   It also leaves DIFFERENTLY: a slide off the right edge rather than a fade.
   A panel that dissolves in place reads as a rendering fault — the eye has
   nothing to attribute the disappearance to — whereas one that leaves the
   frame has somewhere to have gone. The four windows above are all type, and
   type can simply fade. */
export const TAB_WINDOW: readonly [number, number] = [0.03, 0.10];

/* The end-frame haze. Downstream of the void — it can only arrive once there
   is a void for it to arrive in, so it tracks BLACK_WINDOW rather than
   sitting at a fixed place near the end of the page. */
export const BLOOM_WINDOW: readonly [number, number] = [0.5, 0.85];

/* The aircraft's own sequence.

   It climbs while the world goes out, and comes to a stop on exactly the
   frame the background reaches black — BLACK_WINDOW[1] and LIFT_WINDOW[1] are
   the same number on purpose. The turn then begins immediately —
   SPIN_A_WINDOW starts on LIFT_WINDOW[1], so there is no pause between
   rising and turning.

   The turn therefore runs underneath the statement rather than after it. That
   is a deliberate reversal of the earlier arrangement: the aircraft is the
   only thing left moving once the world has gone, and making the reader wait
   for it to finish before the copy arrives left a long inert stretch. */
export const LIFT_WINDOW: readonly [number, number] = [0, 0.09];

/* The turn comes in two, with a stop between them.
 *
 * Each window is ONE FULL REVOLUTION, which is what makes the stop land
 * cleanly: a whole turn returns the aircraft to the heading it started on, so
 * the pause happens at a pose that looks chosen rather than at whatever angle
 * the scroll happened to reach.
 *
 * SPIN_A ENDS WHERE THE CODA HAS FINISHED ARRIVING, and that is a
 * relationship rather than a number: the coda's internal timeline is 0.329
 * done when the headline, the tag and the three-liner are all in, so the
 * aircraft comes to rest on the frame the closing line completes and the turn
 * is what carries the eye from the statement into it.
 *
 * It reads 0.41 now because CODA_WINDOW moved to 0.32. It was 0.51 against a
 * 0.42 start — the same 0.09 offset, kept deliberately. Move the coda again
 * and this has to move with it, or the aircraft stops somewhere the copy is
 * not.
 *
 * Both are smoothstepped, so A decelerates into the stop and B accelerates
 * out of it. The pause reads as the aircraft settling and then being sent
 * again, not as playback being interrupted. The gap between them IS the
 * stop — there is no third window for it, and widening it is how you make
 * the pause longer. */
export const SPIN_A_WINDOW: readonly [number, number] = [0.09, 0.41];
/* Starts 0.05 after A ends, which is the stop, and that gap is preserved
   exactly as it was. The end stays at 0.95 because it is the act's own
   close, so this revolution now runs across 0.49 rather than 0.39 — the
   second turn is slower than it was. That is the cost of moving the coda
   forward and it is a deliberate one: the alternative is finishing the turn
   early and leaving the aircraft still for the last tenth of the act. */
export const SPIN_B_WINDOW: readonly [number, number] = [0.46, 0.95];

/* How far it climbs, in the model's own normalised units (TARGET_SPAN = 0.98
   across, so this is a little over half a wingspan). */
export const LIFT_HEIGHT = 0.50;

/* The aircraft grows as it climbs, so the rise reads as approach rather than
   as mere elevation.

   Physically it DOES get closer to the camera as it lifts — but the camera's
   look point rises with it (_look tracks 0.34 of the climb), which cancels
   most of that out. Left alone the drone would climb half a wingspan and
   barely change size. This puts the approach back deliberately, and further.

   The window runs a little past LIFT_WINDOW on purpose: growth that stops
   dead on the same frame the plate goes black reads as a jump cut. Letting it
   settle a few hundredths into the void hides the end of the move. */
export const GROWTH_WINDOW: readonly [number, number] = [0, 0.16];
export const LIFT_GROWTH = 1.9;

/* When the camera is allowed to change angle.

   Deliberately NOT tied to the lift. The plate is a fixed photograph shot
   from one angle — if the camera cranes while it is still on screen, the
   aircraft's perspective drifts away from the ground it is standing on and
   the composite falls apart. So the camera holds the plate's own angle until
   the plate is switching out, and only then swings to the hero three-quarter,
   finishing before the spin settles. */
export const CAM_TILT_WINDOW: readonly [number, number] = [0.065, 0.28];

/* Where the subject sits in frame, as a fraction of the visible frame at the
   subject's distance. The camera pans by this, so the aircraft moves the
   opposite way: positive x puts it LEFT of centre, positive y puts it DOWN.
   Resolution-independent — it is measured against the frustum, not pixels. */
export const SUBJECT_SHIFT = { x: 0, y: 0.2 };

/* ...and where it ends up: dead centre, arriving with the second turn.
 *
 * Deliberately narrower than SPIN_B_WINDOW at both ends. Starting later
 * means the aircraft is already turning before it begins to move, so the two
 * moves read as one gesture rather than as a single tween driving both;
 * finishing earlier means it settles into the middle of the frame and is
 * still there, composed, while the turn runs out. A centring that lands on
 * the same frame the rotation stops reads as a machine parking. */
export const SUBJECT_CENTRE_WINDOW: readonly [number, number] = [0.62, 0.88];

/* The wordmark does not leave with the rest of beat 0. It shrinks into the
   top-left corner — onto the dot's mark — and stays there as the page's
   logo, which is why it is the one piece of intro type with no --intro fade
   on it. MORPH_TARGET_PX is its final rendered size, sitting on the same
   optical line as the nav. */
export const MORPH_WINDOW: readonly [number, number] = [0.015, 0.08];
export const MORPH_TARGET_PX = 18;

/* The statement pair that lives in the void.

   Starts at 0.10, the moment the last of the corner copy has gone, so the two
   sections run end to end with no dead scroll between them. It begins while
   the plate is still darkening rather than waiting for full black — by then
   the photograph is at a third of its brightness and no longer competing.

   The whole arc — letters lighting up, a hold, then the same sweep taking
   them back out — is scrubbed across this one window, so scrolling back up
   unwrites it exactly as it was written.

   CLOSES AT 0.30, PULLED IN FROM 0.40, so the coda can arrive on a
   particular frame of the aircraft rather than ten frames past it — see
   CODA_WINDOW. The statement's hold is what paid for that: it now has 0.20
   of the act rather than 0.30. The entrance is unchanged; it is the dwell
   before the sweep-out that is shorter. */
export const STATEMENT_WINDOW: readonly [number, number] = [0.1, 0.30];

/* Per-character opacity, not a colour ramp to the background.

   On pure black the two look identical, but they are not: BLOOM_WINDOW and
   STATEMENT_WINDOW overlap across most of their span. A colour ramp leaves
   every unlit glyph sitting at the background
   colour — which stops being the background as soon as the warm haze comes
   up, and the "hidden" letters reappear as dark silhouettes over the glow.
   Opacity has nothing to disagree with. */
export const STATEMENT_CHAR_FADE = 0.3;


/* The coda — the closing panel, after the turn has finished.

   Starts just after STATEMENT_WINDOW closes, so the previous copy has swept
   out before this arrives. Unlike the earlier arrangement it is NOT the last
   thing on screen — it comes in, is held, and fades again to clear the frame
   for the slide. Everything on this page now enters and leaves; nothing is
   left stacked on top of anything else.

   MOVED FROM 0.42 TO 0.32, AND THE FRAME IS THE REASON. The sequence is
   scrubbed straight off act-one progress, so the closing line lands on
   whatever frame that fraction points at: 0.42 was frame 67 of 160 and the
   aircraft had already turned past the pose the line was meant to sit
   against. 0.32 is frame 51 — level, props horizontal, legs down.

   The span is unchanged at 0.36, so the coda itself is paced exactly as
   before; only its start moved. Two other windows had to follow — see
   STATEMENT_WINDOW above, which closes earlier to clear the frame, and
   SPIN_A_WINDOW, which is pinned to where this finishes arriving. */
export const CODA_WINDOW: readonly [number, number] = [0.32, 0.68];

/* The slide.

   A small label writes itself in on the left, a reticle draws around the
   aircraft, and an oversized line travels in from the right and comes to rest
   across the middle of the frame.

   The line renders BEHIND the canvas — the aircraft occludes a letter as it
   passes. That single overlap is what makes the object read as being in the
   scene rather than on top of a picture of one, and it is the whole reason
   this beat is worth building. */
export const SLIDE_WINDOW: readonly [number, number] = [0.8, 1.0];

/* How long the statement sits fully lit, in timeline units, between the sweep
   in and the sweep out. STATEMENT_WINDOW was widened in the same proportion
   as this was lengthened, so the extra time is spent held and readable rather
   than being taken out of the sweeps — otherwise a longer hold just makes the
   letters arrive and leave faster within the same scroll distance. */
export const STATEMENT_HOLD = 2.1;

/* Plate parallax: a slow crane upward and a pull BACK, running only while the
   plate is still visible. Tracked linearly rather than eased — a parallax
   that accelerates and settles reads as an animation playing, where this
   should read as the frame simply following the aircraft up.

   PLATE_OVERSCAN is the STARTING scale, and it is also the coverage budget.
   Translating a full-bleed image exposes its trailing edge unless the image
   is already larger than the frame, and the plate is scaled from its TOP
   edge (transform-origin 50% 0%), not its centre, so every bit of the
   overscan hangs below the fold where the upward pan needs it. Scaling from
   the centre would split it top and bottom and waste half.

   The floor is what makes this number what it is. A 3% upward pan needs at
   least 1.03 of scale under it at every instant, so 1.04 is the tightest the
   plate may ever get. That is why a pull-back cannot simply scale down from
   1.04 — it has to START above and LAND on it. Worst case is the end of the
   pan, where both are at full: 1.04 scale against 3% of travel leaves 1% of
   margin, and anything below 1.03 puts the bottom edge of the photograph in
   frame. */
export const PLATE_PAN_END = 0.09;
export const PLATE_OVERSCAN = 1.1;
export const PLATE_PAN_Y_PCT = -3;

/* A pull BACK, geared to the lift on purpose — and both of those are
   reversals of what this used to be.

   It was a push IN, which fought the shot: as the aircraft climbs away from
   the ground the ground has to recede, and a frame closing in on it says the
   opposite. Negative, so the scale runs 1.10 down to PLATE_OVERSCAN's 1.04
   floor and the field falls away underneath the climb.

   And it now shares LIFT_WINDOW exactly rather than running on its own
   slower, offset clock. The old note argued the two should never feel geared
   together, which is right for an ornamental push-in and wrong here: this
   movement is CAUSED by the climb, so reading as geared to it is the whole
   point. Decoupled, it reads as the camera doing something of its own.

   Keyed to [0, 0.09] because that is the entire visible life of the plate —
   BLACK_WINDOW finishes at 0.09 and the photograph is gone. The old window
   ran to 0.2 and so was only about 27% travelled when the image disappeared,
   which is survivable for a 2.5% push nobody was meant to notice and useless
   for a 6% pull-back that is the point of the beat. */
export const PLATE_ZOOM_WINDOW: readonly [number, number] = [0, 0.09];
export const PLATE_ZOOM = -0.06;

/* ============================================================
   ACT TWO — the aircraft leaves, the gallery runs.

   Fractions of ACT TWO's own clock, which starts where act one ends.
   ============================================================ */

/* The aircraft leaves.

   Not decoration — a necessity. The gallery is a full-frame section, and
   the render is a fixed layer that would otherwise sit behind it for the
   rest of the page with nothing left to do. It has finished its turn by
   act-one 0.95, so by the time this starts it has been static for a while
   and fading it reads as the sequence handing over rather than as the
   subject being taken away.

   Starts at 0.2, once the lockup has landed and the gallery has its first
   photograph in the gate — NOT at 0 as it used to.

   Beginning on ACT_ONE_SPAN exactly was tidy and read as a dismissal: the
   aircraft was gone before the section that replaces it had shown anything,
   so act two opened on an empty frame and then filled it. Holding the last
   frame through the lockup means the subject is still present while the
   line about it shrinks into a label, and it only leaves once the gallery
   has something of its own to hold the eye. The handover has a subject on
   both sides of it rather than a gap in the middle.

   The cost is an overlap: the gate is centred and so is the aircraft, so
   for about a fifth of act two they share the middle of the frame. That is
   survivable because the last frame is small — its bounding box is 670px
   of a 3840 render, roughly 17% of the viewport at cover-fit — and because
   it is already fading while the gate is arriving. If it ever reads as
   clutter, move the START later rather than shortening the span; a fast
   fade is what makes it look dismissed. */
export const EXIT_WINDOW: readonly [number, number] = [0.2, 0.34];

/* The line stops being a headline and becomes a label.

   The oversized "it's compact" that just crossed the frame shrinks and
   flies to the top-left, landing under its own kicker as a two-line
   lockup — the same move oryzo makes, and for the same reason: it is what
   makes the two sections read as one continuous sentence rather than as a
   headline followed by an unrelated gallery.

   Runs BEFORE EXIT_WINDOW and hands straight over to it — this used to
   overlap it, back when the render dissolved across [0, 0.12] and the type
   moving was what carried the eye over the gap. The render now holds until
   0.2, so there is no gap to carry anyone across: the lockup lands on a
   frame that still has the aircraft in it, and the aircraft leaves once the
   line has finished becoming a label. The two are consecutive by
   construction — this ends exactly where EXIT_WINDOW begins, and moving
   either without the other reopens the hole. */
export const LOCKUP_WINDOW: readonly [number, number] = [0, 0.2];

/* Where the lockup comes to rest, and how big the line is when it gets
   there. Fractions of the viewport, so the composition holds at any size;
   the pixel equivalents at 1920x889 are oryzo's own 229px and 48px.

   Both are in vh, not vw, because the gallery's whole geometry is in vh —
   type that scaled on width would drift away from the cards it labels.

   There is deliberately no constant for the lockup's LEFT edge. The kicker
   carries it as an authored percentage and the line is measured onto the
   kicker's rendered position, because the two sit in different containing
   blocks and a shared percentage does not put them in the same column. */
export const LOCKUP_TOP = 0.21;
export const LOCKUP_HEAD_VH = 0.054;

/* ...but never larger than this, in px.

   The vh figure alone was the bug: 0.054vh is 48px only on a 889-tall
   viewport, and on a taller window — a 1440p screen, or anything scaled —
   it kept growing, reaching 60px and up. The pair is a LABEL once it has
   landed, and a label that tracks the window height stops being one.

   So vh below the reference height and a hard ceiling above it: the lockup
   shrinks with a short window but never inflates on a tall one. The kicker
   carries the same ceiling at 32px, in its own class. */
export const LOCKUP_HEAD_MAX = 48;

/* The filmstrip itself.

   Stops at 0.96 rather than 1.0 so the last card comes to rest and is held
   for the final stretch. Running the travel to the exact bottom of the
   document means the seventh photograph arrives on the frame the page runs
   out of scroll and is never actually looked at — and with scrub damping
   it would still be easing into place as the reader hits the end. */
export const GALLERY_WINDOW: readonly [number, number] = [0.16, 0.8];

/* The doorway.

   The last thing in the gate is not a photograph — it is act three itself,
   sitting at card size. Across this window its clip box grows from the gate
   to the whole viewport, so the section is entered by the frame opening
   rather than by one screen replacing another.

   Starts exactly where GALLERY_WINDOW ends, which is the point: the strip
   comes to rest with the bench centred in the gate, and only then does the
   gate begin to open. Overlapping them would have the frame growing while
   its contents were still sliding.

   The scale change across this is only about 1.25x — the gate is portrait
   and the bench is landscape, so the content must already cover the gate's
   height before it can be cropped by it, and that sets a floor on how small
   it can start. The drama is in the CLIP, which opens 3.5x horizontally.
   That is also why none of this needs oryzo's em-scaling: they scale their
   card contents 3.5x and would see the type go soft, where a 1.25x change
   is invisible. */
export const ZOOM_WINDOW: readonly [number, number] = [0.8, 1.0];

/* How much of the doorway is spent still at card size before the box grows.

   The last photograph is LOCKED in the frame for this stretch — the strip
   has stopped, the side thumbnails clear out, and the card simply sits
   there. That pause is the point: it is the composition the whole section
   has been travelling toward, and growing from the first frame of the
   doorway never lets anyone look at it.

   Shared by FieldGallery and FieldBench because they have to agree on it
   exactly. The gallery hands its locked card off ON this boundary and the
   bench starts growing FROM it; two copies of the number would show up as
   the card dissolving before or after the thing behind it starts moving. */
export const ZOOM_HOLD = 0.4;
