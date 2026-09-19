/* ============================================================
   ProductPage — everything about a product that the field page renders.

   The choreography is the reusable part; the words and the pictures are
   not. Until now both lived in the same files, so a second product page
   meant copying FieldHero, FieldGallery and FieldBench and editing strings
   inside them — three forks that would drift the first time a beat was
   retuned, and every timing fix afterwards would have to be made N times.

   So: components take a ProductPage and render it. The type is the contract
   between the two, and it is deliberately strict — a missing panel or a
   short gallery should fail at the type level rather than at 40% scroll on
   someone else's phone.

   WHAT IS NOT IN HERE, on purpose:

   Timing. Every window, span and act length stays in beats.ts, shared by
   all products. A page that retimes the choreography is not another product
   page, it is another page — and it should say so by not using this.

   Geometry. Gate size, panel split, wipe angle, subject fit. Same argument:
   these are the composition, not the content.
   ============================================================ */

import { ACT_ONE_VH, DEFAULT_ACTS, type ActSpec } from './beats';

export type SequenceTier = '1k' | '2k' | '4k';

export type ProductSequence = {
  /** Folder under /public/sequence, per build tier. */
  hero: Record<SequenceTier, string>;
  end: Record<SequenceTier, string>;
  heroFrames: number;
  endFrames: number;
  /* The subject's width in the FIRST frame, as a fraction of the frame.
     MEASURED off the export, not guessed — FieldSequence solves the mobile
     baseline against it and the build tier is chosen from the same number.
     Re-measure after every new export or phones drift off their target
     size and the sequence starts being enlarged again. */
  firstFrameSubjectWidth: number;
};

export type GalleryItem = { src: string; alt: string };

export type BenchPlate = {
  key: string;
  /** Still. Also the video's poster, so it is never optional. */
  src: string;
  /** Optional — a plate without one falls back to its still. */
  video?: string;
  alt: string;
};

export type BenchPanel = {
  key: string;
  icon: string;
  kicker: string;
  /* Each line is masked and revealed separately, so this array IS the line
     breaking. Re-wrapping it changes the choreography, not just the copy. */
  desc: string[];
  title: [string, string];
};

/* THE VIEWER'S CONTRACT.

   Optional, and optional for the same reason `gallery` and `bench` are: a
   page that does not declare a viewer should not be forced to invent
   framings for one. The rule this file already follows holds — an act you
   declare must bring its data.

   Every number in here is authored by eye through the dev picker (see
   pickAnchor.ts), not calculated. They are compositions. */
export type ViewerPose = {
  /** Radians, measured from +Z toward +X — three's Spherical convention. */
  azimuth: number;
  /** Radians from +Y. */
  polar: number;
  /** A FACTOR of the framing distance frameFor() solves against the panel's
   *  live aspect. 1.0 is the default framing; 0.42 is a close-up. Never a
   *  world-unit distance — that would crop on a narrow phone. */
  radius: number;
};

export type ViewerHotspot = {
  /** Shown uppercase in the list and beside the dot. */
  label: string;
  /** Optional. Absent => the row renders as a plain label with no '+', which
   *  is what lets these ship on names alone and gain copy later without a
   *  code change. */
  body?: string;
  /** World-space point in the viewer's FITTED, re-centred space — the model
   *  is normalised to `span` and its bounding box centred on the origin
   *  before this means anything. */
  anchor: [number, number, number];
  /** Outward surface normal at `anchor`. Drives the facing test that fades
   *  the dot when the anchor turns away — see orbit.ts. */
  normal: [number, number, number];
  pose: ViewerPose;
};

export type ProductViewer = {
  /** Was hardcoded in MiniViewer. Here so the component stops knowing which
   *  aircraft it renders. */
  model: string;
  /** Fitted span across the longest axis, in world units. */
  span: number;
  /** The still shown in the frame before anyone has paid for the model.
   *  Also hardcoded in MiniViewer once, which meant a second product would
   *  have advertised the first one's aircraft. */
  poster: string;
  /** The model's size on disk, in bytes.
   *
   *  Stated to the reader before the click, because downloading a few
   *  megabytes is a decision and someone on a metered connection is
   *  entitled to know the price. It was written into the component as the
   *  literal "2.5 MB" — true of the Mini and wrong for anything else, and
   *  silently wrong, which is the worst kind. A number next to the path it
   *  describes at least has a chance of being noticed when the path
   *  changes. */
  bytes: number;
  home: ViewerPose;
  hotspots: ViewerHotspot[];
};

export type ProductPage = {
  /** Which acts this page has, and in what order. Omit one and its beats
   *  never run and its DOM never mounts — see deriveActs in beats.ts.
   *  Defaults to DEFAULT_ACTS when absent. */
  acts?: readonly ActSpec[];

  /** 'P10 Pro'. Used as the wordmark, so its LENGTH is load-bearing —
   *  the display sizes are solved against the character count. */
  name: string;
  kicker: string;
  /** The vertical tab, right edge. */
  tabLabel: string;
  /** The opening paragraph, opposite or under the wordmark. */
  lede: string;

  sequence: ProductSequence;

  /** Act one's void statement. Two lines, then the paragraph beside it.
   *
   *  `aside` is the SECOND paragraph — the one that hangs off the right of
   *  the statement headline in the void. It is optional, and it was found
   *  the way the film card and the poster were: it did not exist at all, and
   *  FieldHero simply had the P10's sentence typed into the JSX. Every
   *  product page therefore claimed to be the P10, in the middle of its own
   *  hero. A page with nothing to say there now says nothing. */
  statement: { head: [string, string]; body: string; aside?: string };

  /** The three short lines that rise beside the coda, small and uppercase.
   *
   *  Optional for the same reason and discovered in the same place: the JSX
   *  carried "Eleven parts come off. / Ninety seconds each. / One driver." as
   *  literals, which is a specification of the P10 and of nothing else.
   *
   *  An array rather than a string because the line breaks are the
   *  choreography: SplitText masks and raises each line separately, so
   *  re-wrapping this changes the animation and not merely the copy. */
  codaNote?: readonly string[];
  /** Act one's coda, and the line that becomes act two's lockup. */
  coda: string;
  slide: string;

  /* OPTIONAL, and the three below with it, because `acts` already made
     them optional in practice — a page that omits an act never mounts its
     DOM, and was then still forced to invent content for it. A Mini page
     carrying P10 Pro's bench copy so the type would compile is worse than
     no bench: it is wrong copy that renders the moment someone adds the
     act back.

     The rule is: an act you declare must bring its data. Presence is
     checked at both use sites (clock AND data) rather than asserted. */
  /** Act two. Order is the order they pass through the gate. */
  gallery?: GalleryItem[];

  /** Act three. `plates` and `panels` are paired BY INDEX, not by key —
   *  plate 0 is behind panel 0. The keys exist to make a mismatch visible
   *  when reading, and they have been wrong before. */
  bench?: {
    plates: BenchPlate[];
    panels: BenchPanel[];
    footnote: { label: string; value: string };
  };

  /** Act four's closing card. */
  closing?: {
    kicker: string;
    /** One line. Sized to SPAN, so the character count is load-bearing —
     *  see the note on the h2 in FieldHero. */
    headline: string;
    body: string;
    label: string;
    cta: { label: string; href: string };
  };

  /** The interactive model. Absent => MiniViewer does not mount, exactly as
   *  a missing act behaves. */
  viewer?: ProductViewer;

  /** A full-bleed looping film BETWEEN the hero and the viewer.
   *
   *  Not `film`, which is a YouTube card inside the hero with a lightbox
   *  behind it. This is a section in its own right that the hero dissolves
   *  into and the viewer then dissolves over — see ProductLoop for why it
   *  has to overlap the section after it. Absent => nothing mounts. */
  loop?: {
    /** H.264, for everything. */
    mp4: string;
    /** VP9, offered first; about half the bytes where it is supported. */
    webm?: string;
    /** First frame of the film, so the section is never a black box while
     *  the video buffers or when motion is reduced. */
    poster: string;
    /** The statement laid over the film: a two-line headline on the left,
     *  a paragraph on the right — the same pair, type and entrance as the
     *  hero's void statement. Either may be omitted and simply does not
     *  render. */
    head?: [string, string];
    body?: string;
  };

  /** The hero's bottom-right media card, and the lightbox behind it.
   *
   *  Optional for the usual reason, and it was found the usual way: the id
   *  and the poster were hardcoded in FieldHero while the TITLE was built
   *  from product.name, so the Mini's hero showed the P10 Pro's film
   *  captioned "Mini — film". A page with no film of its own should not have
   *  to borrow one, and now it does not render the card at all. */
  film?: {
    /** YouTube id, mounted only once the card is pressed — see FieldVideo. */
    id: string;
    /** A LOCAL poster frame. Remote thumbnails would need remotePatterns on
     *  a static export and would put a third-party request back on load. */
    poster: string;
  };

  nav: { label: string; href: string }[];
};

/* ---------------------------------------------------------------------- */

export const P10_PRO: ProductPage = {
  /* All four, in the order the page was built. Left explicit rather than
     relying on the default so the arrangement is visible where the rest of
     the product is. */
  acts: DEFAULT_ACTS,
  name: 'P10 Pro',
  kicker: 'Built for fields. Built in India.',
  tabLabel: '• P10-Pro Model',
  lede:
    'The P10 is not just a drone. It is the airframe every sensor, payload and ' +
    'mission answers to — built to fly, fold, and be fixed where it lands.',

  sequence: {
    hero: { '1k': 'hero1k', '2k': 'hero2k', '4k': 'hero4k' },
    end: { '1k': 'end1k', '2k': 'end2k', '4k': 'end' },
    heroFrames: 110,
    endFrames: 40,
    firstFrameSubjectWidth: 0.19,
  },

  statement: {
    head: ['Isn’t just', 'a drone.'],
    body:
      'Built to fly, fold, and be fixed where it lands. Fifty-two minutes on ' +
      'station, four minutes to service, no tools on the bench.',
    /* Moved out of FieldHero's JSX, where it was a literal and therefore
       rendered on every product's hero regardless of the product. */
    aside:
      'The P10 isn’t just a drone. It’s the airframe every sensor, ' +
      'payload and mission answers to.',
  },

  /* Also moved out of the JSX. Three lines, and the breaks are the
     choreography rather than the wrapping. */
  codaNote: ['Eleven parts come off.', 'Ninety seconds each.', 'One driver.'],
  coda: 'Built to be opened',
  slide: 'it’s compact',

  /* The values that were hardcoded in FieldHero, moved to the one page they
     were ever true for. */
  film: { id: 'RTzzgJ4ZjzE', poster: '/images/p10-film-poster.webp' },

  gallery: [
    { src: '/images/portable2.jpg', alt: 'Arms folded in for transport' },
    { src: '/images/portable4.jpg', alt: 'Case open on a tailgate' },
    { src: '/images/portable1.jpg', alt: 'Packed down beside the pilot' },
    { src: '/images/drone-comparison-mob.jpg', alt: 'P10 Pro on station over a field' },
    { src: '/images/p10pro-spray-m.png', alt: 'P10 Pro folded down, carried by one person' },
    { src: '/images/p10pro-night.png', alt: 'Night flight, navigation lights on' },
  ],

  bench: {
    plates: [
      {
        key: 'endurance',
        src: '/images/p10pro-night.png',
        video: '/videos/bench/night-flight-p10.mp4',
        alt: 'Packs on the headland',
      },
      {
        key: 'service',
        src: '/images/p10pro-portable.jpg',
        video: '/videos/bench/drone-open.mp4',
        alt: 'Airframe opened on the bench',
      },
      {
        key: 'payload',
        src: '/images/p10pro-spray.png',
        video: '/videos/bench/p10-spray.mp4',
        alt: 'Tank and nozzles',
      },
    ],
    panels: [
      {
        key: 'endurance',
        icon: '◇',
        kicker: 'Flies the day',
        desc: [
          'Eighteen minutes loaded, four packs deep.',
          'Hot-swapped on the headland while the',
          'next tank is mixing.',
        ],
        title: ['Eighteen minutes,', 'four packs'],
      },
      {
        key: 'service',
        icon: '↧',
        kicker: 'Opens in the field',
        desc: [
          'Eleven parts come off with one driver.',
          'No jig, no bench vice, no service centre.',
          'The airframe was drawn around the repair,',
          'not the other way round.',
        ],
        title: ['Eleven parts,', 'one driver'],
      },
      {
        key: 'payload',
        icon: '◈',
        kicker: 'Carries the load',
        desc: [
          'Ten litres over six metres of swath.',
          'The tank comes off the same way the arms do,',
          'so a refill is a swap, not a queue.',
        ],
        title: ['Ten litres,', 'six metres'],
      },
    ],
    footnote: { label: 'Swap time per module', value: 't ≈ 90s' },
  },

  closing: {
    kicker: 'Ready for the season',
    headline: 'Bring it to your field',
    body:
      'Eleven parts off with one driver. Ten litres over six metres. ' +
      'Eighteen minutes a pack, hot-swapped on the headland.',
    label: 'P10 Pro',
    cta: { label: 'Book a demo', href: 'mailto:info@droneanatomy.com' },
  },

  nav: [
    { label: 'Intro', href: '/preview/field' },
    { label: 'Modules', href: '/products' },
    { label: 'Payload', href: '/products/p10-pro' },
    { label: 'Contact', href: '/contact' },
  ],
};

/* ---------------------------------------------------------------------- */

/* MINI — the compact airframe, and the first page to use only part of the
   choreography.

   ONE ACT. The page runs act one and stops: the grass, the void, the
   rendered sequence, the statement and the coda. Where P10 Pro goes on to
   the gallery, the bench and the closing card, this fades into an
   interactive 3D viewer instead (see MiniViewer) and then the site footer.
   That is the whole reason `acts` exists — declaring the arrangement here
   rather than forking FieldHero — and it is why gallery, bench and closing
   are absent below rather than filled in with borrowed copy.

   To give it the gallery as well, add { kind: 'gallery', vh: ACT_TWO_VH }
   to the list and a `gallery` array; nothing else has to change. Act two's
   photographs are all of a P10 Pro today, which is the actual reason it is
   not here.

   TWO PLACEHOLDERS, both deliberate and both visible from the outside:

   1. THE SEQUENCE IS P10 PRO'S. Mini has no rendered frames, so act one
      flies a P10 Pro airframe under the name 'Mini'. Point `hero` at Mini's
      own folders when they exist; heroFrames and firstFrameSubjectWidth
      must be re-measured off that export, not carried over.

   2. `end` / `endFrames` are unused. They belong to act four's return,
      which this page does not have. They are filled in because
      ProductSequence requires them, and they cost nothing while no closing
      act reads them.

   THE COPY STATES ONE FIGURE, AND THE RULE IT LOOKS LIKE AN EXCEPTION TO IS
   INTACT. The viewer's third hotspot says "30 Min Flight Time". Every other
   line on this page still talks about the form factor and stops there. The
   rule was never "no numbers" — it was that a number has to come from the
   product rather than from whoever was filling in a type, and this one did.
   Anything added here needs the same provenance. */
export const MINI: ProductPage = {
  acts: [{ kind: 'hero', vh: ACT_ONE_VH }],

  /* Four characters against P10 Pro's seven. The wordmark solves its own
     size from this now — see .bigWord in Field.module.css — so a short
     name is no longer a layout problem, but it is still the number that
     drives it. */
  name: 'Mini',
  kicker: 'Small airframe. Same system.',
  tabLabel: '• Mini Model',
  lede:
    'The Mini is the smallest thing we fly that is still a whole aircraft — ' +
    'the same controller, the same ground station, the same way of being ' +
    'opened and fixed, in a frame that travels on a back.',

  /* THE MINI'S OWN RENDER, at last — this pointed at the P10 Pro's folders
     while it was a placeholder, which meant the Mini's page showed a P10
     Pro flying under the name Mini.

     160 frames, up from that sequence's 110.

     RE-RENDERED AT 2560x1440, AND THAT FIXED A REAL FAULT RATHER THAN
     MERELY ADDING PIXELS. The note here used to say the render was
     1920x1080 and that a bigger number would only buy bandwidth. The second
     half was right; the first was the problem. FieldHero's TIERS declare
     '2k' AS 2560x1440, so a 1920 build in the mini2k folder was undersized
     for the tier that selects it — and pickTier's own comment explains what
     that costs: on a narrow screen the BASELINE binds rather than cover fit,
     so the painter was enlarging the frame to make the aircraft span 60% of
     the canvas. The softness that produces is exactly what that comment
     warns will be inexplicable later.

     '2k' is now a real 2560 build at 11.8 MB, which is the trade pickTier
     already made deliberately and documented at 14.2 MB for the P10 Pro.

     STILL NO 4k FOLDER, and now for the original reason properly: 3840 would
     be an upscale of a 2560 source, so the '4k' key points at the 2560 build.
     The P10 Pro's sequence is genuinely 3840, which is why its entry differs.

     `end` still points at the P10 Pro's closing act. Nothing reads it —
     MINI's `acts` is the hero alone — but it is left resolvable rather
     than removed so the type stays honest about what a ProductPage is. */
  sequence: {
    hero: { '1k': 'mini1k', '2k': 'mini2k', '4k': 'mini2k' },
    end: { '1k': 'end1k', '2k': 'end2k', '4k': 'end' },
    heroFrames: 160,
    endFrames: 40,
    /* Measured off frame 0's alpha bounding box, and RE-MEASURED against the
       2560 render rather than carried over: the subject spans 838..1698 of
       2560, which is 0.3359. The old 1920 build gave 628..1273, or 0.336 —
       the same framing at a different resolution, which is the evidence that
       the re-render is the same animation and not a new camera path.

       The 0.19 here before that was the P10 Pro's number, and at nearly half
       the true value it would have had FieldSequence enlarging the aircraft
       on phones to hit a size it already exceeded. */
    firstFrameSubjectWidth: 0.336,
  },

  /* Ten characters a line, which is what act one's headline size is solved
     against — see the note on the h2 in FieldHero. */
  statement: {
    head: ['Packs down.', 'Flies far.'],
    body:
      'Folds into a case that goes where the crew goes, and comes out flying ' +
      'the same stack as every other airframe on the fleet.',
  },
  coda: 'Built to travel light',
  slide: 'it packs down',

  /* COMPOSED IN THE BROWSER, NOT CALCULATED.

     Every value below came off pickAnchor.ts: the camera was flown to the
     shot by hand, the part was shift-clicked, and the logged block was
     pasted here. That matters most for the poses. They were arithmetic to
     begin with — a camera pointed roughly at each anchor — and arithmetic
     cannot tell you that a framing is half a rotor away from being right.

     The normals came along for free, and they are the half that could not
     have been authored any other way: each one is the true surface normal at
     the point that was clicked, which is what lets a dot know it has turned
     away. Two of them are off-axis (01 sits on a chamfer, 04 on the curve of
     the lens housing), and neither is a value anyone would have typed.

     ORDER IS THE ORDER THEY ARE READ, and the arrows step through it. */
  viewer: {
    model: '/models/mini.glb',
    span: 3.2,
    poster: '/images/mini-viewer-poster.webp',
    /* 2,587,764 bytes, which is the 2.5 MB the gate has always claimed. */
    bytes: 2587764,

    /* Today's VIEW vector (0.6, 0.17, 0.72) as spherical. Preserved exactly
       so the crossfade out of the hero lands on the framing readers have
       been looking at for the whole of act one. */
    home: { azimuth: 0.695, polar: 1.391, radius: 1.0 },

    hotspots: [
      {
        label: 'EW Capable',
        /* The outboard face of Body1129, the grey block on the top deck at
           the rear. Its centre is x = 0.233 with a half-extent of 0.0675, so
           x = 0.3 is the face itself rather than a point floating beside it,
           and the normal is very nearly pure +X to match.

           Sits directly above Body1128 — the thin fin at the same x, one of
           a symmetric pair — so the dot reads as marking that assembly
           rather than the bare shell.

           High on the aircraft, at y = 0.381 against a top of 0.485, which is
           what keeps it clear of the body below it at this framing. */
        anchor: [0.3, 0.381, 0.612],
        normal: [0.98, 0.067, 0.187],
        pose: { azimuth: 1.202, polar: 1.376, radius: 0.44 },
      },
      {
        label: 'CF Single Body',
        /* The flank of the CAMO pod. There is no feature under this one —
           it is an argument about the whole airframe, which is why its
           framing is a wide side elevation rather than a close-up, and why
           the anchor is the pod's own side rather than a part. */
        /* x = 0.326 is exactly the CAMO pod's half-width, so this is the
           flank itself rather than a point hovering near it. The pose came
           back at azimuth 1.546 and polar 1.591 — within a degree and a half
           of dead square-on, which is the shot this hotspot wants and close
           enough to π/2 that rounding it would be tidier than it is true. */
        anchor: [0.326, -0.201, -0.19],
        normal: [1, 0, 0],
        pose: { azimuth: 1.546, polar: 1.591, radius: 0.95 },
      },
      {
        label: '30 Min Flight Time',
        /* THE REAR FACE, not the top deck the seed guessed at. z = 0.707 is
           the back of the pod — the aircraft's rearmost body surface, where
           a pack is actually reached — and the normal is a clean +Z, so the
           dot is visible from behind and gone from the front.

           The pose looks down from polar 0.735, which is well above the
           equator. That is what makes a rear-facing anchor legible: square on
           to +Z the pod is a flat panel, and the aircraft reads as an
           outline. */
        anchor: [0.042, -0.119, 0.707],
        normal: [0, 0, 1],
        pose: { azimuth: 0.363, polar: 0.735, radius: 0.5 },
      },
      {
        label: 'Day & Night Vision',
        /* On the LENS mesh itself (Body1086), at z = -1.183 against a front
           extreme of -1.192 — the glass, not the housing around it.

           The normal is the one value here no amount of care would have got
           by hand: mostly -Z but tilted down and outboard, because the lens
           is a curved surface and this is where on that curve the point sits.
           A typed [0, 0, -1] would have kept the dot lit slightly past the
           angle at which the glass actually turns away.

           Still faces away from the home framing, so this dot is faded until
           the row is used — which remains the clearest argument for the list
           existing at all. */
        anchor: [-0.114, -0.184, -1.183],
        normal: [0.211, -0.315, -0.925],
        pose: { azimuth: 2.853, polar: 1.468, radius: 0.42 },
      },
    ],
  },

  nav: [
    { label: 'Intro', href: '/products/mini' },
    { label: 'Systems', href: '/products' },
    { label: 'P10 Pro', href: '/products/p10-pro' },
    { label: 'Contact', href: '/contact' },
  ],
};

/* ---------------------------------------------------------------------- */

/* NOXR — the second page to run the Mini's arrangement, and the first to
   prove that arrangement is reusable rather than a one-off.

   ONE ACT, as the Mini has: the hero, then the interactive viewer, then the
   site footer. `acts` says so, which is the whole reason that field exists.

   COPY IS DELIBERATELY UNWRITTEN. Every string below marked PLACEHOLDER is
   awaiting real text and says so where a reader will see it — on the page,
   not only in this file. That is the honest version of a scaffold: the
   alternative is inventing a kicker and a lede that read as approved copy
   the moment they render, which is exactly the failure the note on MINI's
   figures warns about. Replace each one and nothing else has to change.

   THE ASSETS ARE REAL. The sequence, the model, the poster and the framing
   constants below are all measured off this product's own files, so the page
   is a true picture of the aircraft with placeholder words on it — never the
   reverse. */
export const NOXR: ProductPage = {
  acts: [{ kind: 'hero', vh: ACT_ONE_VH }],

  /* Four characters, the same count as 'Mini', so the wordmark solves to
     the same size and the two pages sit at the same scale. */
  name: 'Noxr',

  kicker: 'PLACEHOLDER — one line, sets the product up',
  tabLabel: '• Noxr Model',
  lede:
    'PLACEHOLDER — the opening paragraph, three or four lines. The Mini’s ' +
    'runs to about forty words and is sized against that length, so this ' +
    'wants to be in the same range.',

  /* Ten characters a line is what act one's headline size is solved
     against — see the note on the h2 in FieldHero. Two SHORT lines. */
  statement: {
    head: ['PLACEHOLDER', 'TWO LINES'],
    body: 'PLACEHOLDER — the paragraph that sits beside the statement.',
  },
  coda: 'PLACEHOLDER — the closing line',
  slide: 'placeholder',

  /* MEASURED OFF THIS RENDER, none of it carried over from the Mini.

     160 frames at 2560x1440, run through scripts/build-sequence.mjs at the
     q96 the Mini uses. Both tiers are real: 1280x720 and the native 2560,
     which is what FieldHero's TIERS declares '2k' to be.

     `end` points at the P10 Pro's closing act. Nothing reads it — this
     page's `acts` is the hero alone — but it is left resolvable so the type
     stays honest about what a ProductPage is, exactly as MINI does. */
  sequence: {
    hero: { '1k': 'noxr1k', '2k': 'noxr2k', '4k': 'noxr2k' },
    end: { '1k': 'end1k', '2k': 'end2k', '4k': 'end' },
    heroFrames: 160,
    endFrames: 40,
    /* Measured off frame 1's alpha bounding box: the subject spans
       1092..1462 of 2560.

       RE-MEASURED FOR THE V2 RENDER, and it moved a long way — the first
       render put the subject at 0.2188 (982..1542) and this one starts the
       aircraft a third smaller. Carrying the old number across would have
       told FieldSequence the aircraft was half again the size it is, and
       the mobile baseline is solved against exactly this: it would have
       stopped enlarging the frame at two thirds of the intended size and
       the sequence would have looked soft with nothing to explain it.

       It is also the tightest of the three products — the Mini is 0.336 —
       so this page leans hardest on the larger build. That is the trade
       pickTier already documents, not a new one. */
    firstFrameSubjectWidth: 0.1445,
  },

  /* THE ANCHORS ARE REAL, THE FRAMINGS ARE NOT.

     This export has semantic node names — Battery, back Holder — so the
     anchors below sit on parts found by name rather than picked blind, and
     the LENS material gives the camera its own centroid. The poses are
     arithmetic that points a camera roughly at each one, and they are meant
     to be replaced by framings composed in the browser. Shift-click with
     the dev picker and paste; see pickAnchor.ts.

     Front is +Z on this airframe — the LENS centroid sits at z = +0.574 —
     which is the opposite of the Mini. Worth knowing before reading any of
     these numbers against that page's. */
  viewer: {
    model: '/models/noxr.glb',
    span: 3.2,
    /* THE SEQUENCE'S OWN LAST FRAME, which is the rule the Mini's poster
       follows and for the same reason: the hero dissolves into this panel,
       so the still behind the gate should be the frame the hero just left
       on. Anything else makes the click read as swapping the aircraft for a
       different one rather than getting closer to the same one.

       It was frame 51 briefly, chosen when the FIRST render ended on the
       aircraft receding to a 236px speck. The V2 render ends head-on, so
       the rule applies again and the exception is gone.

       CROPPED AT NATIVE RESOLUTION, NOT SCALED TO A SUBJECT WIDTH. The
       aircraft is 260px in that frame, so the Mini's 62% convention would
       have meant a 2.7x upscale. The panel enlarges a 260px subject either
       way — that softness is in the render, not in the crop — so this takes
       the sharp version and lets the aircraft sit small, at 22.8% of the
       poster, exactly as it sits in the frame it came from. */
    poster: '/images/noxr-viewer-poster.webp',
    /* 1,416,544 bytes, down from 3,864,476. Two changes, no geometry lost:
       the 10.79 MB export is Draco-compressed (which is what got it to 3.86
       MB), and its two 1024x1024 maps are now webp rather than PNG — 2.79 MB
       of texture became 331 KB for the same pixels.

       WEBP HERE IS NOT OPTIONAL. glTF core admits only JPEG and PNG, so the
       file declares EXT_texture_webp as REQUIRED and carries no PNG
       fallback. three.js has read that extension since r132 and every
       browser this site targets decodes webp; a loader that does not will
       refuse the file outright rather than render it untextured, which is
       the honest failure and the reason the flag is set.

       The geometry is the original's, untouched: 46 meshes with the body
       instanced 48 times. An export that applied a decimate modifier
       instead measured LARGER (5.63 MB), because flattening those instances
       into distinct meshes more than doubled the unique vertex count.
       Encoding was always the lever here; detail never was. */
    bytes: 1416544,

    /* The Mini's opening framing, reused deliberately: it is a neutral
       three-quarter view and there is no reason for two product pages to
       introduce their aircraft from different angles. */
    home: { azimuth: 0.695, polar: 1.391, radius: 1.0 },

    hotspots: [
      {
        label: 'PLACEHOLDER 01',
        /* The LENS meshes' centroid, pushed onto the front face. */
        anchor: [0.043, 0.182, 0.6],
        normal: [0, 0, 1],
        pose: { azimuth: 0.2, polar: 1.45, radius: 0.45 },
      },
      {
        label: 'PLACEHOLDER 02',
        /* The top face of the node literally called Battery: centre
           [-0.006, 0.089, -0.382] with a half-height of 0.204. */
        anchor: [-0.006, 0.293, -0.382],
        normal: [0, 1, 0],
        pose: { azimuth: 3.0, polar: 0.8, radius: 0.5 },
      },
      {
        label: 'PLACEHOLDER 03',
        /* The top of the front-right motor housing (Body5.007). */
        anchor: [0.885, 0.37, 0.907],
        normal: [0, 1, 0],
        pose: { azimuth: 0.8, polar: 0.85, radius: 0.55 },
      },
      {
        label: 'PLACEHOLDER 04',
        /* The outboard face of 'back Holder', one of a symmetric pair. */
        anchor: [0.286, -0.023, -0.416],
        normal: [1, 0, 0],
        pose: { azimuth: 1.6, polar: 1.3, radius: 0.5 },
      },
    ],
  },

  nav: [
    { label: 'Intro', href: '/products/noxr-1' },
    { label: 'Systems', href: '/products' },
    { label: 'Mini', href: '/products/mini' },
    { label: 'Contact', href: '/contact' },
  ],
};

/* ---------------------------------------------------------------------- */

/* CYCLOPS — the VTOL airframe, and the first page to run THREE steps: the
   sequence, a looping film, then the model.

   Same scaffold discipline as NOXR. The assets and every number derived
   from them are measured off this product's own files; the words are
   PLACEHOLDER and say so on the page. */
export const CYCLOPS: ProductPage = {
  acts: [{ kind: 'hero', vh: ACT_ONE_VH }],

  /* Seven characters against the Mini's and Noxr's four. The wordmark is
     solved against its own length, so this sets smaller than those two —
     expected, not a fault, and the thing to look at first if the hero's
     headline reads undersized. */
  name: 'Cyclops',

  kicker: 'PLACEHOLDER — one line, sets the product up',
  tabLabel: '• Cyclops Model',
  lede:
    'PLACEHOLDER — the opening paragraph, three or four lines. The Mini’s ' +
    'runs to about forty words and is sized against that length, so this ' +
    'wants to be in the same range.',

  statement: {
    head: ['PLACEHOLDER', 'TWO LINES'],
    body: 'PLACEHOLDER — the paragraph that sits beside the statement.',
  },
  coda: 'PLACEHOLDER — the closing line',
  slide: 'placeholder',

  /* 140 frames at 2560x1440 from "04 SEQ S", through build-sequence.mjs at
     q96: 86.6 MB of PNG became 14.1 MB at 2K and 5.7 MB at 1K. There is no
     4K render, so '4k' points at the native 2K build, as NOXR's does. */
  sequence: {
    hero: { '1k': 'cyclops1k', '2k': 'cyclops2k', '4k': 'cyclops2k' },
    end: { '1k': 'end1k', '2k': 'end2k', '4k': 'end' },
    heroFrames: 140,
    endFrames: 40,
    /* Frame 0's alpha bounding box spans x 726..2058 of 2560. The largest
       of the three products by a distance — the Mini is 0.336 and Noxr
       0.1445 — so this page leans least on the larger tier. */
    firstFrameSubjectWidth: 0.5207,
  },

  /* "04 DRONE LOOP.mp4" was 2560x1440 H.264 at 7.78 MB for four seconds —
     15.5 Mbps, which is a master rather than something to put in a page.
     Scaled to 1920 and re-encoded with no audio track (it had none):
     H.264 CRF 22 is 4.17 MB, VP9 CRF 34 is 1.89 MB. */
  loop: {
    mp4: '/video/cyclops.mp4',
    webm: '/video/cyclops.webm',
    poster: '/video/cyclops-poster.jpg',
    head: ['PLACEHOLDER', 'TWO LINES'],
    body: 'PLACEHOLDER — the paragraph that sits beside the headline on the film.',
  },

  /* THE ANCHORS ARE MEASURED, THE FRAMINGS ARE NOT.

     Anchors come from this model's own geometry — the rotor blade centroids
     and the bounding box — mapped into the space the viewer draws in. That
     space is not the file's: loadCraft moves the root by minus the bbox
     centre (0.3045, 0.097, -0.005) and scales it by span / widest extent =
     3.2 / 4.415 = 0.7248, and the scale lands on the vertices while the
     offset does not, so a point p in the file draws at 0.7248 * p - centre.

     THE NOSE IS -X, not the +X the LENS material suggests; that lens is a
     light on the tail. The rotor layout settles it — see the note at the
     lead's loadCraft call in FlightScene. Pose azimuth 0 faces +z and -pi/2
     faces -x, which is where every framing below is aimed from.

     Poses are arithmetic pointing roughly at each anchor. Replace them with
     framings composed in the browser: shift-click with the dev picker and
     paste — see pickAnchor.ts. */
  viewer: {
    model: '/models/vtol.glb',
    span: 3.2,
    /* The sequence's own last frame, cropped so the aircraft fills 62% of
       the poster width — the Mini's convention. That frame's subject is
       1013px wide, so this is a 0.70x DOWNscale and stays sharp, unlike
       Noxr's, which had to sit small to avoid enlarging a 260px aircraft. */
    poster: '/images/cyclops-viewer-poster.webp',
    /* 2,650,256 bytes. 17.23 MB as exported: webp textures and Draco took
       it to 2.71 MB, and joining every non-blade mesh took the draw calls
       from 463 to 31 for another 0.18 MB off. The ten blade nodes were
       kept separate on purpose — join merges by material, and a merged
       blade mesh cannot turn about more than one hub. */
    bytes: 2650256,

    /* A front three-quarter: between the nose at -x and the right wing at
       +z, a little above the wing plane. */
    home: { azimuth: -0.9, polar: 1.25, radius: 1.0 },

    hotspots: [
      {
        label: 'PLACEHOLDER 01',
        /* The nose, at the bbox's -x extreme (-0.902 in the file). */
        anchor: [-0.958, 0.0, 0.005],
        normal: [-1, 0, 0],
        pose: { azimuth: -1.45, polar: 1.35, radius: 0.5 },
      },
      {
        label: 'PLACEHOLDER 02',
        /* A forward lift rotor: blade centroid (-0.620, -0.067, 0.500). */
        anchor: [-0.754, -0.146, 0.367],
        normal: [0, 1, 0],
        pose: { azimuth: -0.9, polar: 0.75, radius: 0.5 },
      },
      {
        label: 'PLACEHOLDER 03',
        /* The wingtip propeller on +z: centroid (0.245, 0.040, 1.495). */
        anchor: [-0.127, -0.068, 1.089],
        normal: [0, 0, 1],
        pose: { azimuth: 0.2, polar: 1.3, radius: 0.5 },
      },
      {
        label: 'PLACEHOLDER 04',
        /* The pusher on the centreline: hub (0.703, 0.100, 0.000). */
        anchor: [0.205, -0.025, 0.005],
        normal: [1, 0, 0],
        pose: { azimuth: 1.6, polar: 1.25, radius: 0.5 },
      },
    ],
  },

  nav: [
    { label: 'Intro', href: '/products/cyclops' },
    { label: 'Systems', href: '/products' },
    { label: 'Noxr', href: '/products/noxr-1' },
    { label: 'Contact', href: '/contact' },
  ],
};
