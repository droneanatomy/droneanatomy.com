/* ============================================================
   flightBeats — the scene registry for the scroll-driven flight.

   Same spine as field/beats.ts: scenes declare their LENGTH IN VIEWPORT
   HEIGHTS, and the fractions are derived. Nothing downstream ever sees a
   pixel or a hard-coded fraction, so retiming a scene is a one-number
   edit and every window that reads off it moves with it.

   This is also, almost exactly, how the reference site does it. Theirs:

     HEIGHTS = { 'intro-scene':100, 'delta-drone':500, … }   // % of vh
     let t = 0
     SCENES.map(id => { const start = t; t += HEIGHTS[id]/100*vh; … })

   Fifteen scenes over 67 viewport heights. Ours is deliberately shorter —
   five scenes over 26 — because their length is carried by fifteen
   distinct set-pieces and we should earn that before we claim it.
   ============================================================ */

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/* Ease for camera travel. Scroll is linear and a linear camera reads
   mechanical, so every leg is eased in and out of its keyframes. */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* The longest step the scene clock will take in one frame — a slow 10fps
   frame, so anything genuinely rendered passes through untouched. */
export const MAX_FRAME_SEC = 0.1;

/* THE SCENE CLOCK, AND WHY IT IS NOT WALL TIME.

   FlightScene's frame loop returns early when the section is out of view, so
   THREE.Clock goes unread while the reader is elsewhere on the page. Its
   getDelta() measures from the LAST READ, so the entire absence arrives as a
   single delta on the frame the section comes back — measured at 6.073s
   after six seconds away.

   Everything on the loop is sin(t / period) with periods of six to ten
   seconds, so most of a cycle would be crossed in one frame and the bob,
   drift, orbit swing, breathe and bank would all teleport together. A
   transition caught mid-flight is cut at the same instant, because its
   progress is (t - start) / duration and that ratio lands past 1. Those two
   are the violent shake on re-entry, and they have one cause.

   The loop already integrates the terrain from a clamped delta, and the note
   there explains exactly this hazard for the ground. This applies the same
   rule to time itself, so every consumer of `t` inherits it rather than each
   one having to remember.

   Time therefore advances only while the scene is being watched. That is the
   right meaning here: these are idle loops on a shot the reader is looking
   at, not a simulation that has to stay true to the wall. */
/* ADVANCE A LOOP PHASE BY ONE FRAME — integrated, never recomputed.

   The idle loops used phase = t / period, and `period` is lerped between the
   two scenes during a transition. Recomputed that way, a period change jumps
   the phase by t x (1/periodA - 1/periodB) cycles over one blend, and t is
   the time the reader has spent on the section: harmless after ten seconds,
   several full swings of bob, drift and orbit inside one transition after a
   few minutes. That was the jitter.

   Integrated, a period change alters only the RATE, so no single frame can
   advance more than dt at the shorter period, whatever t is. The floor of 1s
   matches the Math.max(1, period) the old expression carried. */
export const advancePhase = (phase: number, dt: number, period: number) =>
  dt > 0 ? phase + (dt / Math.max(1, period)) * Math.PI * 2 : phase;

export const advanceClock = (prev: number, delta: number) => {
  /* Refuses NaN rather than accumulating it. phase is derived from this, so
     one bad value would not glitch a frame — it would make every later frame
     NaN and the aircraft would vanish for good. */
  if (!Number.isFinite(delta)) return delta > 0 ? prev + MAX_FRAME_SEC : prev;
  if (delta <= 0) return prev;
  return prev + Math.min(delta, MAX_FRAME_SEC);
};

/* Four beats. `climb` was a fifth — a settle-and-away shot after the
   survey — and it is gone: the section now ENDS on the survey camera,
   with a still taking the frame the moment that transition lands. There
   is nothing to fly away to. */
export type SceneId = 'approach' | 'transit' | 'swarm' | 'survey';

/* A scene's LOOK: where it is, how it is framed, how it is lit.

   This is the change that makes the page behave like the reference. It
   does not fly a continuous path with the camera trailing — each scene is
   a SET PIECE with its own station, framing and atmosphere, the camera
   HOLDS there while ambient animation carries the frame, and scroll's job
   is the move between one set piece and the next.

   Measured on their page: scrubbing a whole scene start to end changed
   22.48 mean luma, while sitting still for four seconds changed 16.56.
   The camera barely moves inside a scene. What moves is the world, on the
   clock, and then the whole look switches. */
export type Look = {
  /* Where the craft sits. x and z are world units; Y IS CLEARANCE ABOVE
     THE GROUND, not an absolute height — the land streams underneath, so
     an absolute height would let a ridge rise straight through the craft. */
  craft: [number, number, number];
  /* Which way it faces — a point it is heading toward, same convention. */
  heading: [number, number, number];
  /* Camera, RELATIVE to the craft, and what it aims at (also relative). */
  cam: [number, number, number];
  aim: [number, number, number];
  /* Fog near/far. Per scene, exactly as the reference does it — this is
     most of what makes one beat feel tight and the next feel vast. */
  fog: [number, number];
  /* Sky and fog colour. Shifting it per scene changes the hour of day
     between beats, which is the cheapest way to make two shots of the
     same terrain read as two different places. */
  /* THE SKY IS ALSO THE FOG, and that makes it the single strongest
     influence on what colour the land reads as. At these fog distances the
     haze is most of the signal in any mid-ground pixel — measured at the
     fleet beat, roughly four fifths of it — so the terrain converges on
     this colour long before its own albedo gets a say.

     Which is why these are GREEN greys rather than warm greys. They used
     to run #d0ccc5 to #d6d3ce, all of them R > G > B, and the effect was
     that a hillside painted convincingly green (57% of its vertices, G
     above R by a clear margin) still rendered as sand: the albedo was
     fine and the haze was quietly overruling it.

     Each was re-tinted to G > R > B and RE-BALANCED TO THE SAME
     LUMINANCE, per channel, within about one value level of the original.
     That part is not incidental — this section's copy is ink and its nav
     is dark, both of which were set against these exact backdrops, so the
     hue can move but the brightness cannot. */
  sky: string;
  /* Field of view. Wide for vistas, long for the product shots. */
  fov: number;
  /* Is the fleet in formation in this scene? */
  fleet: boolean;
  /* Fly the lead LEVEL, ignoring the heading's height.

     Without this the aircraft pitches nose-down, and by a margin the
     numbers here do not show: the craft's altitude has the terrain height
     under it added every frame (craftPos.y += groundRef) while `heading`
     stays absolute, so the drop the lead looks down is 6 units PLUS
     whatever the ground below is doing. Over tall country that is a
     steep, wandering dive rather than the degree or two the table
     suggests.

     The fleet has always ignored the heading's y for this reason. Setting
     this makes the lead do the same. It blends across a transition, so a
     scene that wants the pitch back gets it smoothly. */
  level?: boolean;
  /* The scene's LOOPING animation, in amplitudes. Runs on the clock,
     forever, independent of scroll — this is the shot, not decoration.
     Scroll never touches these. */
  loop: {
    /* Radians the camera swings around the craft per cycle. */
    orbit: number;
    /* World units the camera pushes in and out. */
    push: number;
    /* World units the craft rises and falls. */
    bob: number;
    /* World units the craft slides across frame. */
    drift: number;
    /* Seconds for one full cycle. */
    period: number;
    /* World units per second the LAND travels past. This is what makes
       the craft read as flying rather than hovering: it never moves, the
       terrain does. Per scene, because a vista should stream past slowly
       and a low pass should tear past.

       Halved across every beat once the craft was lifted. The two are
       related and not independent: apparent speed falls off with
       altitude, so ground that looked right tearing past at 62 units of
       clearance looks frantic from 130. Raise the heights again and
       these want to come down again with them. */
    speed: number;
  };
};

export type SceneSpec = {
  id: SceneId;
  /* Length in viewport heights. 100 = one screen of scrolling.

     Since scroll only TRIGGERS a transition, this is not the length of an
     animation — it is just how far you scroll before the next one fires.
     It was 450-600 while scroll was scrubbing the camera and the move
     needed the distance; now that the move runs on its own clock, that
     distance is only dead scrolling with the loop playing. ~170 gives
     each scene a beat to be seen without making anyone work for it. */
  vh: number;
  /* Seconds for the move INTO this beat, overriding TRANSITION_SEC.

     Per-beat because the moves are not the same size. Approach to transit
     is a lens change; swarm to survey drops the camera from 129.5 units
     out to 29.6 while the pitch swings 62.4 to 35.7 degrees — far more
     ground to cover, and the one most likely to read as a whip at a
     duration that suits the others. Omit it and the global applies. */
  enterSec?: number;
  look: Look;
  /* Deck copy for this scene, rendered as real DOM over the canvas. */
  kicker: string;
  title: string;
  body: string;
};

/* How much of a scene is HOLD versus TRANSITION.

   Below this fraction the scene sits at its own look and only the clock
   moves anything. Above it, the look crossfades into the next scene's.
   0.62 gives roughly three screens of held set piece then two of travel,
   at the scene lengths below. */
/* Seconds a transition takes once triggered.

   NOT scroll-linked. Scroll fires it and then lets go — the move plays
   out on its own clock at its own pace, the same way a cut does. Scrubbing
   a transition ties its speed to how fast someone happens to be spinning
   a wheel, which is why a scrubbed page never has timing of its own. */
/* 0.6, trimmed a full second off 1.6.

   The move between set pieces is a CUT that happens to be continuous, not
   a journey — at 1.6s the camera arrived, and then kept arriving, and the
   beat that followed had to wait for it. Nothing downstream needed the
   length: the read-out that closes the section starts on the settle, so
   trimming the move simply brings it forward. */
export const TRANSITION_SEC = 0.6;

/* Which scene the scroll position is asking for. The band is the scene's
   own span; crossing a boundary is the trigger, and nothing between
   boundaries means anything. */
export const sceneAt = (pageP: number, clock: readonly SceneClock[]) => {
  for (let i = clock.length - 1; i >= 0; i--) {
    if (pageP >= clock[i].start) return i;
  }
  return 0;
};

/* THE FOUR SHOTS ARE AUTHORED IN BLENDER, not tuned here.

   mini_cams.glb carries four cameras parented to the aircraft
   (Camera <- UP <- "type 7 v39"), which is the same convention `cam` and
   `aim` already use — camera relative to craft — so they transfer
   directly. What they say, as pitch/yaw/distance:

     beat 1  35.6 deg down, 143.8 deg off the tail (ahead-right), d 36.5
     beat 2  62.4 deg down, dead ahead,                            d 62.1
     beat 3  62.4 deg down, dead ahead,                            d 129.5
     beat 4  35.6 deg down,  42.4 deg off the tail (behind-left),  d 29.6

   Beats 2 and 3 are the SAME ANGLE at twice the distance: that pair is
   the zoom-out where the fleet arrives.

   DISTANCES ARE SCALED BY 1.2724, and this is the only conversion that
   matters. Blender's world and this one size the aircraft differently —
   8.645 units there against the 11 loadCraft builds here — so raw offsets
   would frame it wrong by 27%. Angles and fov transfer untouched.

   TWO THINGS DID NOT SURVIVE THE TRIP, and both need saying:

   ROLL. The Blender cameras carry 16.1 deg of roll on beats 1 and 4 and
   3.1 deg on 2 and 3. This scene aims with camera.lookAt() and a world
   up vector, which forces roll to zero — see the call below. Reproducing
   it means giving the camera an explicit up, not a new number here.

   CRAFT CLEARANCE. `craft[1]` is height above the GROUND, and the two
   worlds do not share a vertical scale — the Blender terrain tops out
   around 74.6 units where this one uses PEAK 240.

   ONE STATION, FOUR CAMERAS — which is how the shots were authored.

   In mini_cams.glb the aircraft sits at a single place and only the
   cameras move around it. The beats used to move the CRAFT as well, which
   meant each of those camera offsets was being measured from an origin
   Blender had never seen, and beats 1 and 4 framed empty sky.

   The altitude is derived rather than copied, because the two worlds do
   not share a vertical scale: Blender's terrain tops out at 74.6 units
   with the drone 167.1 above it. In drone spans — the only unit that
   carries across — that is 19.33, so 19.33 x 11 = 213 here.

   FOG HAD TO MOVE WITH IT. At fov 22.9 and this altitude the ground sits
   301-401 units along the view axis, and the old far planes were as tight
   as 300 — the land was entirely beyond them, which is why beat 1 showed
   nothing but sky. The near plane has to clear the craft's own distance
   too (29.6 to 129.5) or the subject fogs along with the scenery.
 */
export const SCENES: readonly SceneSpec[] = [
  {
    id: 'approach',
    vh: 170,
    /* HEAD-ON, high and to the side: the aircraft flies AT the reader.

       FORWARD IS -Z — the heading sits at z -200 against a craft at z 0 —
       so a camera at negative z stands in front of the aircraft and
       watches it come on, and one at positive z falls in behind and
       watches it leave. This sat at -24.2 originally, was moved to +25.5
       on a misread of the reference frame (a front three-quarter taken
       for a rear one; the pointed end near the lens is the nose, not the
       tail), and is back in front where it belongs.

       WHAT SURVIVED THAT ROUND TRIP is the height and the aim, which were
       the actual improvement. Standoff is 34.5 units and the camera sits
       31 degrees above the aircraft, against 36.4 and 35 before — near
       enough that the fov, the fog and the loop's crawl all still read as
       they were tuned to.

       TERRAIN FILLS THE FRAME for a geometric reason rather than an
       authored one: looking down 31 degrees from 18 units above a craft
       at y 213, the sightline past the airframe meets ground about 384
       units out, well inside the 1400-unit far fog. It is land behind the
       aircraft, not sky, and that falls out of the angle alone.

       aim drops to -1.5 so the lens points just under the airframe, which
       lifts the aircraft a little above centre and gives the ground the
       lower two thirds. */
    look: {
      craft: [0, 213, 0], heading: [25, 207, -200],
      cam: [13.5, 17.5, -25.5], aim: [-0.9, -1.5, -1.2],
      fog: [180, 1400], sky: '#cacfc4', fov: 22.9, fleet: false, level: true,
      // a slow crawl around the airframe — the product turntable beat
      loop: { orbit: 0.42, push: 2.2, bob: 0.5, drift: 0.4, period: 26, speed: 24 },
    },
    kicker: 'VTOL',
    title: 'Vertical launch,\nfixed-wing range',
    body: 'Lifts on rotors, transitions to wing-borne cruise. No runway, no launcher.',
  },
  {
    id: 'transit',
    vh: 160,
    /* Pull right out. Deep fog, wide lens, craft small against the range —
       the opposite of the shot before it, which is the point. */
    look: {
      craft: [0, 213, 0], heading: [25, 207, -200],
      cam: [-1.2, 54.8, -29.2], aim: [-0.2, -0.3, -0.5],
      fog: [200, 1100], sky: '#bcc1b4', fov: 22.9, fleet: false,
      // barely anything. A vista should feel still; the haze does the work
      loop: { orbit: 0.10, push: 6.0, bob: 1.6, drift: 3.2, period: 38, speed: 58 },
    },
    kicker: 'Transit',
    title: 'Cruise to the\nwork area',
    body: 'Wing-borne flight covers the distance a multirotor spends its battery on.',
  },
  {
    id: 'swarm',
    vh: 200,
    /* Above and slightly behind, so the formation reads as a group rather
       than as one craft with clutter around it. */
    look: {
      craft: [0, 213, 0], heading: [25, 207, -200],
      cam: [-1.7, 115.7, -58.2], aim: [0.3, 0.9, 1.7],
      fog: [260, 1500], sky: '#c1c6b9', fov: 22.9, fleet: true,
      // the formation jostles and the camera drifts along the line
      loop: { orbit: 0.30, push: 3.4, bob: 0.9, drift: 2.0, period: 22, speed: 36 },
    },
    kicker: 'Fleet',
    title: 'One controller,\nevery airframe',
    body: 'The VTOL, the P10 Pro and the observation platform fly the same radio and the same ground station.',
  },
  {
    id: 'survey',
    /* 240 — A HELD BEAT, and deliberately so.

       This is the room the close needs: for the transition to land, the
       sensor lines and the frame to draw, and a hold on the thermal view
       before the next section comes up. At 120 the whole ending fitted in
       about one viewport and the move appeared to cut.

       It was briefly cut to 30, so that reaching the thermal frame carried
       straight on to the next section with about 15vh of pin; that was
       reverted by request — the scroll is meant to dwell here. */
    vh: 240,
    /* THE LONGEST MOVE IN THE SECTION, and the one to trim if the cut
       feels whippy: the camera comes in from 129.5 units to 29.6 while
       pitching 62.4 to 35.7 degrees. Raise it to slow this move alone;
       lower it to snap harder. Delete the line to fall back to
       TRANSITION_SEC. */
    enterSec: 0.6,
    /* THE ONE BEAT THAT HOLDS STILL. speed is 0 below, which is not a
       tuned-down number but a different kind of shot: the land does not
       stream past, the aircraft hovers, and the whole thing is a held
       frame with an instrument open over it. Everything else on this page
       is in motion; this one earns its place by not being. */
    /* SUPERSEDED IN PART — READ THIS FIRST.

       The camera below is no longer the one the rest of this block
       reasons about. It now comes from mini_cams.glb (Camera_beat4),
       and the clearance is the derived 213 rather than the 150 the beam
       geometry was solved against.

       What that breaks is NOT the framing — the Blender camera puts the
       aircraft 39% right of centre and 82% down, which is the bottom-right
       placement this block asks for. It is the SENSOR that is stranded:
       the footprint, its lean and the thermal plate were all solved
       jointly with the old camera and the old altitude, so the cone now
       lands outside the frame the shot actually holds. Everything below
       about the beam is history until that is re-solved.

       THE ONE SHOT THAT LOOKS DOWN.

       This was another over-the-shoulder chase, 33 degrees below the
       horizon — which made it the second scene in the sequence framed
       almost exactly like the first, and made the thermal read-out it
       now carries close to unreadable. A detection overlay is painted on
       the GROUND; at a shallow depression the ground is a sliver across
       the bottom of frame, so the anomalies arrived at the edge, smeared
       down whatever slope they landed on, and left before they could be
       looked at.

       Pitched to 53 degrees and lifted to 230 above the land, the frame
       is ground from top to bottom and the patches read as what they
       are: a survey plate with things marked on it. It also gives the
       five beats a shape they did not have — close, wide, formation,
       DOWN, away — instead of two chase shots with a vista between them.

       The aircraft is still in it, at about 150 units and roughly a
       tenth of frame height. Deliberately: pushed any higher the plate
       gets better and the product disappears out of it, and this is a
       page about the aircraft. */
    look: {
      /* Clearance raised from 105. The beam has to lean 150 units forward
         to put its footprint where the shot wants it, and over 105 of
         drop that is a 55-degree lean — a searchlight, not a sensor. At
         150 it is 45, which reads as looking ahead rather than sideways.

         The nose now points at the FOOTPRINT rather than off along the
         old flight path. A hovering aircraft that is staring at something
         should be facing it; the previous heading had it yawed 70 degrees
         away from its own beam. */
      craft: [0, 213, 0],
      /* The ONE heading that is not the common one. This beat hovers and
         stares, so the nose points at the footprint's own x/z — 134,
         -204 — rather than down the travel direction the other three
         share. Height stays just under the craft's, as before: aiming at
         the ground itself would pitch the nose 49 degrees down, which is
         a dive, not a look. */
      heading: [-99, 207, -224],

      /* SOLVED, not eyeballed, because the brief was specific: aircraft
         in the bottom right, its beam landing a little right of centre.

         Worked in the camera's own basis. With the camera facing straight
         down-track (cam.x and aim.x equal, so the lateral component is
         zero) screen-right is world +x and screen-up is the tilted -z,
         which makes both positions closed-form. The aircraft lands at
         (72%, 72%) of frame and the footprint at (58%, 50%); the beam
         therefore runs up and to the left, out of the corner and into the
         middle of the shot.

         The three numbers are coupled and none of them is free: cam.y and
         cam.z together set how far below centre the aircraft falls (they
         trade against each other at roughly 10 units of height per 13 of
         setback), cam.x = aim.x sets how far right, and FOOT in
         sensorCone.ts sets where the beam lands. Move one and the others
         want re-solving. */
      /* MIRRORED FROM THE BLENDER CAMERA, on purpose.

         Camera_beat4 sits behind-LEFT of the aircraft, which frames it at
         72.5% of the width — bottom RIGHT. The brief is bottom LEFT with
         the aircraft pointing up-right, so the camera's lateral offset is
         flipped: cam.x -14.3 -> +14.3 and aim.x -2.7 -> +2.7. Nothing
         else moves. Pitch stays 35.7 degrees down and the distance stays
         29.6; only the yaw goes from -42.5 to +42.5 degrees off the tail.

         That puts the aircraft at 27.5% of the width, still 9.2% up — the
         mirror image of what Blender renders. If the shot should be
         authored this way rather than derived, mirror the camera in the
         .blend and re-export; this stays a two-number difference. */
      cam: [14.3, 20.7, 15.6], aim: [2.7, 3.9, -4.7],

      /* Widened with the framing. The ground now runs from about 430
         units out at the bottom of frame to 770 at the top, and the old
         900 put the far edge into flat haze. */
      fog: [180, 1400], sky: '#c2c7b7', fov: 22.9, fleet: false,
      /* A HOVER. speed 0 stops the land dead; what is left is a slow
         breathe on the camera and enough bob to keep the airframe alive.
         From overhead a swinging camera reads as the LAND rolling, which
         is nauseating rather than alive, so the orbit is nearly nothing. */
      loop: { orbit: 0.08, push: 3.0, bob: 1.6, drift: 0.6, period: 22, speed: 0 },
    },
    kicker: 'Survey',
    title: 'Reads the field\nas it flies',
    body: 'Onboard detection tags what it sees and streams it down live.',
  },
];

export type SceneClock = {
  id: SceneId;
  /* Fractions of the whole scroll, 0..1. */
  start: number;
  span: number;
};

/* Derived, never typed. Same shape as deriveActs. */
export const deriveScenes = (scenes: readonly SceneSpec[]) => {
  const totalVh = scenes.reduce((t, s) => t + s.vh, 0);
  let acc = 0;
  const clock = scenes.map((s) => {
    const c: SceneClock = { id: s.id, start: acc / totalVh, span: s.vh / totalVh };
    acc += s.vh;
    return c;
  });
  const byId = Object.fromEntries(clock.map((c) => [c.id, c])) as Record<SceneId, SceneClock>;
  return { totalVh, clock, byId };
};

export const FLIGHT = deriveScenes(SCENES);

/* sceneProgress() and copyOpacity() lived here to serve the scrubbed
   model, where a scene's fractional progress drove both the camera and
   the copy's opacity. Nothing reads a fractional progress any more —
   scroll produces a scene INDEX and the rest is time — so they are gone
   rather than left to look load-bearing. */
