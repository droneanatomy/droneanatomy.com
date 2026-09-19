/* ============================================================
   flightModel — how the aircraft on /fly actually fly.

   PURE, and deliberately so: no three, no terrain, no DOM, no clock. The
   ground arrives as a sampled height and time arrives as a dt, which is
   what lets every claim in here be a test rather than an opinion.

   EVERYTHING IS AN ACCELERATION. There is no mass anywhere. Mass only
   ever appears divided back out again, so carrying it would mean two
   numbers to tune where one will do.

   THE COEFFICIENTS ARE SOLVED FROM THE FLEET TABLE, never typed in. The
   speeds in FlyGame's FLEET are the aircraft's published character; here
   they become the equations the coefficients must satisfy, so the fleet
   keeps flying at the speeds it already advertises and the tests can
   assert that it does.
   ============================================================ */

/* Gravity, in world units per second squared. Reasoned from the world's
   scale rather than picked: the Cyclops spans 11 units and about 2.2 m,
   so a unit is roughly 0.2 m and 9.81 m/s^2 is about 49. This is the
   first number to reach for if the whole fleet feels heavy or floaty. */
export const G = 45;

/* Thrust-to-weight for a multirotor, and how far it may lean. 35 degrees
   is about where a sport quad sits before the vertical component of its
   thrust starts costing it altitude it cannot spare. */
const QUAD_TWR = 2.0;
const TILT_MAX = (35 * Math.PI) / 180;

/* How much more lift the wing can make at its best angle of attack than
   it makes trimmed for cruise. This single ratio sets the stall speed. */
const CLMAX_RATIO = 2.2;

/* The four lift rotors' combined authority. The 0.6 over weight is what
   gives the VTOL a hover climb rate at all. */
const LIFT_TWR = 1.6;

/* The blend window, as fractions of stall speed. It must OPEN below the
   stall and CLOSE above it: closing above is what guarantees the wing can
   carry the aircraft by the time the lift rotors are done. */
const TRANS_START = 0.85;
const TRANS_END = 1.17;

export type AirframeSpec = {
  key: string;
  span: number;
  /** Cruise and top speed, world units per second. */
  speed: number;
  boost: number;
  /** Yaw rate, radians per second. */
  turn: number;
  /** Best climb rate, world units per second. */
  climb: number;
  /** A multirotor. A false here means a fixed wing. */
  strafe: boolean;
};

export type Airframe = {
  key: string;
  wing: boolean;
  span: number;
  turn: number;
  climb: number;
  strafe: boolean;
  cruise: number;
  top: number;
  /** Lift coefficient trimmed for cruise, and the most the wing can make. */
  CL: number;
  CLmax: number;
  CD: number;
  thrustMax: number;
  hoverThrust: number;
  liftThrustMax: number;
  tiltMax: number;
  tiltCruise: number;
  /** How far a wing banks on full stick. Solved from the table's turn
      rate; 0 for a multirotor, which yaws with a key instead. */
  bankMax: number;
  vTransStart: number;
  vTransEnd: number;
};

export function deriveAirframe(s: AirframeSpec): Airframe {
  const wing = !s.strafe;
  const base = {
    key: s.key,
    wing,
    span: s.span,
    turn: s.turn,
    climb: s.climb,
    strafe: s.strafe,
    cruise: s.speed,
    top: s.boost,
    hoverThrust: G,
  };

  if (wing) {
    const CL = G / (s.speed * s.speed);
    const CLmax = CLMAX_RATIO * CL;
    /* Solved from two requirements at once: full thrust equals drag at the
       top speed, AND the excess thrust at cruise produces exactly the
       published climb rate. Both published numbers therefore hold by
       construction, and Task 1's tests assert the algebra rather than
       trusting it. */
    const thrustMax = (G * s.climb) / s.speed / (1 - (s.speed / s.boost) ** 2);
    const CD = thrustMax / (s.boost * s.boost);
    const vStall = Math.sqrt(G / CLmax);
    return {
      ...base,
      CL,
      CLmax,
      CD,
      thrustMax,
      liftThrustMax: G * LIFT_TWR,
      tiltMax: TILT_MAX,
      tiltCruise: TILT_MAX,
      /* A banked turn's rate is omega = G * tan(phi) / v, so the bank that
         delivers the table's turn rate AT CRUISE is atan(turn * cruise / G)
         — 49.4 degrees for the Cyclops. Solved rather than typed, like
         everything else here, and it is what finally gives `turn` a
         meaning for an airframe that has no rudder key. The rate falling
         off as the aircraft goes faster is not a loss of authority, it is
         what a real banked turn does. */
      bankMax: Math.atan((s.turn * s.speed) / G),
      vTransStart: vStall * TRANS_START,
      vTransEnd: vStall * TRANS_END,
    };
  }

  /* CD comes from the BOOST speed at full lean, not from cruise. */
  const CD = (G * Math.tan(TILT_MAX)) / (s.boost * s.boost);
  return {
    ...base,
    CL: 0,
    CLmax: 0,
    CD,
    thrustMax: G * QUAD_TWR,
    liftThrustMax: G * QUAD_TWR,
    tiltMax: TILT_MAX,
    tiltCruise: Math.atan((s.speed * s.speed * CD) / G),
    bankMax: 0, // a multirotor banks to strafe, and that is capped by tiltMax
    vTransStart: 0,
    vTransEnd: 0,
  };
}

export const stallSpeed = (a: Airframe) => (a.wing ? Math.sqrt(G / a.CLmax) : 0);

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* THE TRANSITION IS NOT A STATE. It is this one number, and because it is
   a function of airspeed rather than of a timer, it runs backwards for
   free: slow down and the lift rotors come back, which is the whole of
   back-transition and the reason landing needs no code of its own.

   A multirotor returns 1 always — it has nothing to transition to, and
   giving it the same call keeps step() free of airframe branches here. */
export const liftShare = (airspeed: number, a: Airframe) =>
  a.wing ? 1 - smoothstep(a.vTransStart, a.vTransEnd, airspeed) : 1;

export type Mode = 'grounded' | 'spooling' | 'flying' | 'lost';

/* Long enough that the aircraft is visibly getting ready rather than
   leaping. This beat IS the takeoff: a craft that unsticks the instant a
   key goes down reads as a toy, however good the model under it is. */
export const SPOOL_SEC = 1.2;
export const LOST_SEC = 1.5;

/* How gently, and how level, an arrival has to be. */
const LAND_SINK = 4;
const LAND_TILT = (12 * Math.PI) / 180;

/* A slow, LEVEL touchdown is a landing; anything faster or steeper is a
   crash — and "faster" has to include HORIZONTAL speed, or a 70 u/s
   arrival into a ridge face reads as a landing because only sink and
   attitude were ever checked. What "slow enough, horizontally" means is
   airframe-specific, and each half is an existing derived quantity
   rather than a new invented number:

   A WING has exactly one honest way to say it has stopped FLYING: it
   has back-transitioned onto its lift rotors, which this module already
   computes as liftShare (1 - smoothstep(vTransStart, vTransEnd, v), a
   quantity solved from the fleet table via vTransStart/vTransEnd, not
   typed in). liftShare hits exactly 1 only once airspeed has dropped to
   vTransStart — checking that is a stronger and more honest statement
   than any raw speed threshold, because it is the same test the module
   already uses everywhere else to mean "no longer wing-borne", and it
   is why the pitch/attitude check above is even meaningful for a wing:
   a fast, wing-borne arrival is what THIS is for.

   A MULTIROTOR has no transition to check — liftShare is always 1 for
   one regardless of speed (it can hover from a standstill at any
   altitude), so it says nothing here. It also has no stall speed or any
   other fleet-table-derived quantity that scales a "safe horizontal
   speed" per airframe the way liftShare does for a wing. Rather than
   invent one, it reuses LAND_SINK: the same absolute "slow" its sink
   rate is already held to, applied to the other two axes. Every
   existing quad landing test arrives at essentially zero horizontal
   speed anyway (none of them steer or slide on the way down), so this
   changes nothing for them while still closing the same hole for a
   quad drifting in fast sideways. */
export const touchdownVerdict = (s: FlightState, a: Airframe): 'landed' | 'lost' => {
  const gentle = -s.vy < LAND_SINK;
  const level = Math.abs(s.pitch) < LAND_TILT && Math.abs(s.roll) < LAND_TILT;
  const slowEnough = a.wing ? s.liftShare >= 1 : Math.hypot(s.vx, s.vz) < LAND_SINK;
  return gentle && level && slowEnough ? 'landed' : 'lost';
};

/* THE LANDING FLARE, in stepQuad/stepWing: within a stopping distance of
   the ground, a commanded descent already sinking faster than
   FLARE_SINK gets pulled back to FLARE_SINK.

   GATING ON CURRENT SINK, NOT JUST ON "A DESCENT IS COMMANDED": an
   earlier version clamped the TARGET the instant any descent was
   commanded near the ground, with no regard for how fast the craft
   actually was falling. That is what a HELD key needs, but it also
   caught the PULSED, low-duty-cycle descent used elsewhere to reach the
   ground without this flare at all (a 15-30% duty cycle, already gentle
   by construction) — the same clamp that rescues a full dive also
   flattened a duty cycle that was never in danger, pinning it in a
   permanent low hover next to the ground it was trying to reach. Gating
   on "-vy already past FLARE_SINK" leaves a descent that is already
   gentle alone, and only intervenes once it genuinely is not: with this
   gate, a 1-in-6 pulse (16.7%, inside the working range) lands as it
   did before the flare existed, a 1-in-7 pulse (14.3%, below it) still
   doesn't — matching the same 15-30% boundary — and a held key still
   lands instead of crashing.

   flareRadius() BELOW, NOT A SPAN MULTIPLE: an earlier version triggered
   at a fixed number of spans (5, chosen by sweeping MINI's
   held-descent-from-hover until it stopped crashing). That number was a
   typed-in proxy for something the climb controller already determines
   exactly — this module's stated ethos is coefficients solved from the
   fleet table, never typed in, and a span multiple fails that twice
   over: it doesn't explain the 5, and for CYCLOPS (span 11, gain 0.9,
   climb 30) it gives a 55-unit trigger radius on a 1600-unit-wide plate
   with peaks at 240 and valleys at -30 — 55 AGL is ordinary low cruise,
   so a held descent from y=120 at cruise took 14.9s and 1045 world
   units to reach the ground: a forced glideslope across 65% of the map,
   not a flare.

   The real quantity is the climb loop's own stopping distance: bringing
   vy from -a.climb to -FLARE_SINK at rate `gain` (the same 1.6 / 0.9
   literal already in each function's climbAccel line, ignoring the
   drag feedforward and ge as second-order) integrates to exactly
   (a.climb - FLARE_SINK) / gain of altitude. 1.3x that is the margin
   sweeping found necessary once drag, ge and discrete stepping are
   accounted for — MINI: 8.5 * 1.3 = 11.05 (indistinguishable from the
   5-span, 11-unit value found by sweeping), CYCLOPS: 30.7 * 1.3 = 39.9
   (against 55 for 5 spans), Noxr: predicted 14.3. Tried and rejected:
   an altitude-proportional cap (-max(FLARE_SINK, agl*0.8)) — CYCLOPS
   still crashes at -13.6 u/s under it, and it reintroduces the
   pulsed-technique regression on every airframe. */
const FLARE_SINK = LAND_SINK * 0.6;
const flareRadius = (a: Airframe, gain: number) => 1.3 * (a.climb - FLARE_SINK) / gain;

export type Controls = {
  /** 1 = W, -1 = S. A SPEED demand, not a thrust lever: the autothrottle
      below turns it into thrust, which is the assist that lets the fleet
      table's speeds be reachable without the pilot trimming anything. */
  throttle: -1 | 0 | 1;
  /** 1 = A, -1 = D. */
  steer: -1 | 0 | 1;
  /** 1 = Space, -1 = Shift. A climb RATE demand. */
  lift: -1 | 0 | 1;
  /** 1 = E, -1 = Q. Multirotors only. */
  slide: -1 | 0 | 1;
  boost: boolean;
  start: boolean;
};

export const NEUTRAL: Controls = {
  throttle: 0, steer: 0, lift: 0, slide: 0, boost: false, start: false,
};

export type FlightState = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number; roll: number;
  /** This frame's accelerations. Scratch, written by whichever airframe
      branch ran and consumed by integrate() — fields rather than a
      returned vector so a frame allocates nothing. */
  ax: number; ay: number; az: number;
  mode: Mode;
  /** Seconds spent in the current mode. */
  since: number;
  /** Rotor spool, 0..1, for feel and the HUD during 'spooling'. Thrust is
      NOT gated on this: it is always 1 by the time any force is computed
      (see the ground-effect comment in stepQuad), so scaling thrust by it
      would be dead weight at best and would zero the thrust of any state
      that skips spooling straight into 'flying' at worst. */
  rotor: number;
  /** Last computed lift share — read by the rotor groups and the HUD. */
  liftShare: number;
};

export const newState = (x: number, y: number, z: number): FlightState => ({
  x, y, z,
  vx: 0, vy: 0, vz: 0,
  yaw: 0, pitch: 0, roll: 0,
  ax: 0, ay: 0, az: 0,
  mode: 'grounded',
  since: 0,
  rotor: 0,
  liftShare: 1,
});

/* The plate does not repeat across x, so the craft is turned back before
   its edge shows. A push that grows with the overshoot, not a wall.
   650 = TERRAIN_SIZE / 2 - 150, the same wall FlyGame's terrain already
   enforces; written as a literal because this module may not import
   terrain. */
const WALL_X = 650;

/* A frame longer than this is a tab that was in the background, not a
   slow computer. Integrating it would tunnel the craft through the
   ground; the same clamp FlightScene already applies to its own clock. */
const MAX_DT = 0.1;

const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-dt * rate));

const setMode = (s: FlightState, m: Mode) => {
  s.mode = m;
  s.since = 0;
};

export function step(s: FlightState, a: Airframe, c: Controls, groundY: number, dt: number): void {
  const h = Math.min(MAX_DT, Math.max(0, dt));
  if (h === 0) return;
  s.since += h;

  if (s.mode === 'grounded') {
    s.rotor = 0;
    s.vx = s.vy = s.vz = 0;
    s.pitch = s.roll = 0;
    s.y = groundY;
    if (c.start) setMode(s, 'spooling');
    return;
  }

  if (s.mode === 'spooling') {
    /* Ramp rotor 0..1 purely for feel and the HUD. No thrust is computed
       here at all — the craft stays glued to the ground for the whole
       beat and only starts flying, at full rotor, the frame after this
       one ends. (Thrust is NOT scaled by rotor once flying starts: every
       test above that jumps straight into 'flying' does so without ever
       touching rotor, so gating thrust on it would zero their thrust and
       take the whole regression suite down with it. See the ground-effect
       comment in stepQuad for the rest of this reasoning.) */
    s.rotor = clamp01(s.since / SPOOL_SEC);
    s.y = groundY;
    if (s.rotor >= 1) setMode(s, 'flying');
    return;
  }

  if (s.mode === 'lost') {
    s.rotor = 0;
    s.vx = s.vy = s.vz = 0;
    s.y = groundY;
    if (s.since >= LOST_SEC) setMode(s, 'grounded');
    return;
  }

  if (s.mode !== 'flying') return;

  const airspeed = Math.hypot(s.vx, s.vy, s.vz);
  s.liftShare = liftShare(airspeed, a);

  /* The two airframes write this frame's accelerations into s.ax/ay/az and
     nothing else; everything downstream of a force is shared. */
  if (a.wing) stepWing(s, a, c, h, airspeed, groundY);
  else stepQuad(s, a, c, h, airspeed, groundY);

  integrate(s, a, h, groundY);
}

/* ============================================================
   The multirotor.
   ============================================================ */
function stepQuad(s: FlightState, a: Airframe, c: Controls, h: number, airspeed: number, groundY: number) {
  /* ---- yaw -------------------------------------------------------- */
  /* A multirotor turns because a key said so: yaw is a direct rate
     command, independent of where the craft is actually going. The wing
     below has no such line — see stepWing. */
  s.yaw += c.steer * a.turn * h;

  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  const rx = Math.cos(s.yaw);
  const rz = -Math.sin(s.yaw);

  /* ---- lean, and the thrust that comes with it -------------------- */
  /* A quad's TILT is what accelerates it: lean the thrust vector forward
     and its horizontal component is the only force driving the aircraft.
     The cap is the published cruise lean, raised to the full lean while
     boost is held, which is what makes both published speeds reachable. */
  const cap = c.boost ? a.tiltMax : a.tiltCruise;
  const wantTilt = c.throttle > 0 ? cap : c.throttle < 0 ? -a.tiltCruise : 0;
  s.pitch = approach(s.pitch, wantTilt, 3, h);

  const wantSlide = c.slide * (a.strafe ? cap * 0.6 : 0);
  s.roll = approach(s.roll, -wantSlide, 3, h);

  /* Thrust holds altitude while leaning, plus whatever the climb rate
     controller is asking for. Capped, so a quad cannot out-climb itself.

     Drag opposes the full 3D velocity (below), so vertical drag alone
     costs a climbing quad ay = -CD * v * vy — a real force the proportional
     term below never cancels on its own, since it drives climbAccel to
     zero as soon as vy reaches the target. Left uncompensated, the loop
     settles into a droop well short of the published rate. The feedforward
     below adds exactly the drag the craft will be fighting once it is
     climbing at that rate, so the equilibrium lands ON wantClimb instead
     of below it. It uses this frame's incoming speed, one step stale,
     which is accurate enough at 60 Hz and costs nothing to compute. */
  /* Distance above the ground. Reused below by the landing flare and by
     ground effect. */
  const agl = s.y - groundY;

  /* LANDING FLARE — see the FLARE_SINK/flareRadius comment above the
     Mode type for the full reasoning, including why the radius is this
     loop's own stopping distance and why the gate reads the CURRENT
     sink rate rather than just "a descent is commanded". A held descend
     key commands the airframe's full climb rate, which for every ship
     in the fleet sinks far faster than LAND_SINK — so a visitor doing
     the obvious thing (hold Shift and wait) crashes every time. Once
     already sinking faster than FLARE_SINK, and within stopping
     distance of the ground at THIS loop's gain (1.6), pull the
     commanded sink back to FLARE_SINK. Climbing is untouched — this
     only softens a commanded DEScent that has already become
     dangerous. */
  const wantClimbRaw = c.lift * a.climb;
  const wantClimb =
    wantClimbRaw < 0 && agl < flareRadius(a, 1.6) && -s.vy > FLARE_SINK ? Math.max(wantClimbRaw, -FLARE_SINK) : wantClimbRaw;
  const climbDragFF = a.CD * airspeed * wantClimb;
  const climbAccel = climbDragFF + (wantClimb - s.vy) * 1.6;
  const lean = Math.max(0.3, Math.cos(s.pitch) * Math.cos(s.roll));

  /* GROUND EFFECT. A rotor close to the ground works against its own
     reflected downwash and gets more thrust for nothing, which is why a
     real quad feels like it unsticks rather than climbs. Two lines.
     ge is applied INSIDE the clamp, not after it, so thrust can never
     exceed a.thrustMax — applying it outside let a near-ground quad
     exceed its own stated thrust ceiling by up to 12%.

     NOT also scaled by rotor^2: rotor is pinned at exactly 1 for the
     entire time this function can run. The 'spooling' branch above
     returns before stepQuad is ever called, so rotor never takes any
     other value while a force is being computed — squaring it here would
     be decoration, not a real gate. Worse than decoration, actually: every
     test that sets s.mode = 'flying' directly skips spooling and leaves
     s.rotor at newState's default of 0, so gating thrust on rotor^2 would
     zero their thrust and fail the whole existing suite. */
  const ge = agl < a.span ? 1 + 0.12 * (1 - agl / a.span) : 1;
  const thrust = Math.min(a.thrustMax, Math.max(0, (G + climbAccel) / lean) * ge);

  s.ax = (fx * Math.sin(s.pitch) + rx * Math.sin(s.roll)) * thrust;
  s.az = (fz * Math.sin(s.pitch) + rz * Math.sin(s.roll)) * thrust;
  s.ay = thrust * lean - G;
}

/* ============================================================
   The wing.

   A WING IS NOT A QUAD WITH DIFFERENT NUMBERS.

   Three things make it different and all three are here:

   LIFT COMES FROM SPEED, not from a rotor. It acts along the aircraft's
   own up vector, so banking tilts it and the horizontal component turns
   the aircraft. That is a real coordinated turn and it is why the wing
   needs no rudder key — the bank IS the turn.

   THE ANGLE OF ATTACK IS TRIMMED FOR YOU, up to CLmax. That clamp is the
   stall: ask for more lift than the wing can make at this speed and you
   simply do not get it, and the aircraft sinks. Nothing anywhere says
   "if airspeed < stall then". It falls out.

   THE AUTOTHROTTLE IS AN ASSIST and is marked as one. It converts the
   speed demand into thrust, which is what lets the published cruise and
   boost speeds be steady states a pilot reaches by holding one key.
   ============================================================ */
function stepWing(s: FlightState, a: Airframe, c: Controls, h: number, airspeed: number, groundY: number) {
  /* Yaw follows the velocity for a wing — it goes where it is pointed
     only because it is turning, never because a key said so.

     FIRST, before any force reads it. Every other quantity in here is
     built from this frame's velocity, and yaw must be too: computed after
     the forces instead, it describes the velocity from before the last
     integrate, so in a hard turn the craft's right vector trails the
     flight path and the bank's horizontal lift leaks a component forward.
     That leak acts as free thrust, and since it scales with dt the
     autothrottle trims to a different cruise speed on every refresh rate
     — 71.46 u/s at 60Hz against 72.85 at 30Hz. From here the spread is
     70.49 against 70.98. */
  if (Math.hypot(s.vx, s.vz) > 5) s.yaw = Math.atan2(-s.vx, -s.vz);

  const fx = -Math.sin(s.yaw);
  const fz = -Math.cos(s.yaw);
  const rx = Math.cos(s.yaw);
  const rz = -Math.sin(s.yaw);

  /* ---- autothrottle ------------------------------------------------ */
  /* The thrust REQUIRED to hold the target is known exactly — it is the
     drag there, and CD was solved from the fleet table — so ask for it
     directly and leave the proportional term only the gap to close. A
     bare gain cannot do this: at the target the error is zero, so the
     thrust is zero, and the aircraft settles wherever gain and drag
     happen to balance — for the Cyclops that is 66.7, not the 70 printed
     on the page. The feedforward makes both published speeds exact fixed
     points of this loop rather than numbers it approaches from below. */
  const target = c.throttle > 0 ? (c.boost ? a.top : a.cruise) : c.throttle < 0 ? 0 : a.cruise * 0.6;
  const thrust = Math.max(0, Math.min(a.thrustMax, a.CD * target * target + (target - airspeed) * 0.5));

  /* ---- bank, and the turn it produces ------------------------------ */
  /* Roll is positive-right, the same convention the multirotor's
     `rx * Math.sin(s.roll)` above already uses. steer is 1 for A, which
     is left, so it banks left — and the multirotor's `yaw += steer *
     turn` turns left on the same key. One set of controls, two airframes.

     bankMax is solved from the fleet table's turn rate, so holding the
     key at cruise delivers exactly the rate the table advertises. */
  const wantRoll = -c.steer * a.bankMax;
  s.roll = approach(s.roll, wantRoll, 2.2, h);

  /* ---- lift, trimmed to hold the commanded climb, clamped at CLmax -- */
  /* The same drag feedforward the multirotor's climb controller carries,
     and for the same reason: drag opposes the full 3D velocity, so a
     climbing aircraft pays ay = -CD * v * vy, and the proportional term
     cannot cover it because it goes to zero exactly as vy reaches the
     target. Left out, the Cyclops settles around 28 against a published
     30. Adding back the drag it will be fighting at that rate puts the
     equilibrium ON wantClimb: the (wantClimb - vy) factor then cancels
     out of both sides. Inert whenever no climb is commanded. */
  /* LANDING FLARE — see the FLARE_SINK/flareRadius comment above the
     Mode type for the full reasoning. Applied here too so both
     airframes answer a held descend key the same way, at THIS loop's
     own gain (0.9). */
  const agl = s.y - groundY;
  const wantClimbRaw = c.lift * a.climb;
  const wantClimb =
    wantClimbRaw < 0 && agl < flareRadius(a, 0.9) && -s.vy > FLARE_SINK ? Math.max(wantClimbRaw, -FLARE_SINK) : wantClimbRaw;
  const climbAccel = a.CD * airspeed * wantClimb + (wantClimb - s.vy) * 0.9;
  const demand = G + climbAccel;
  const cosRoll = Math.max(0.2, Math.cos(s.roll));
  /* Tilted lift has to be longer to leave the same amount pointing up,
     which is why a banked turn holds its altitude instead of descending. */
  const needed = demand / cosRoll;

  /* The two lift sources SPLIT the demand rather than both answering it
     in full. Answering it twice is what makes a tiltrotor balloon on its
     way through the window with the stick centred — the mirror image of
     the hole liftShare() exists to prevent, and just as visible.

     The split is only safe while the wing can actually cover the part
     handed to it, and the condition for that is

         CLmax * v^2  >=  (1 - liftShare(v)) * G

     What guarantees it is TRANS_END being greater than 1: the window
     CLOSES ABOVE THE STALL, so by the time liftShare reaches 0 and the
     wing is asked for the whole weight, it is already flying fast enough
     to make it. Inside the window it is asked for strictly less than the
     weight while flying at a speed that is already most of the stall
     speed, and the margin is comfortable — the tightest point in the
     whole sweep is 14.4 of slack out of a weight of 45.

     NOT implied by liftShare's own invariant, which is a statement about
     the lift AVAILABLE from both sources and is weaker than this. That
     invariant gives CLmax * v^2 > G - liftShare * liftThrustMax, and with
     liftThrustMax = 1.6G the subtracted term is LARGER than the
     liftShare * G this needs, so the bound it yields is looser, not
     tighter: at liftShare 0.5 it promises only 9 where 22.5 is required.
     TRANS_END is what does the work here, so tune that, not this. */
  const v2 = airspeed * airspeed;
  const wingShare = (1 - s.liftShare) * needed;
  const CLcmd = v2 > 1 ? Math.min(a.CLmax, Math.max(0, wingShare / v2)) : 0;
  const wingLift = CLcmd * v2;

  /* The lift rotors, while the blend still gives them a share.
     GROUND EFFECT, same two lines as the quad's — see the comment there
     for why this is not also scaled by rotor^2, and why ge is applied
     INSIDE the clamp so liftThrustMax stays a real ceiling. */
  const ge = agl < a.span ? 1 + 0.12 * (1 - agl / a.span) : 1;
  const rotorLift = s.liftShare * Math.min(a.liftThrustMax, Math.max(0, demand) * ge);

  s.ax = fx * thrust + rx * Math.sin(s.roll) * wingLift;
  s.az = fz * thrust + rz * Math.sin(s.roll) * wingLift;
  s.ay = wingLift * cosRoll + rotorLift - G;

  /* The nose follows the flight path, which is what makes a stall LOOK
     like one: lift runs out, the aircraft sinks, and the nose drops
     because the aircraft is now going downwards. */
  const path = Math.atan2(-s.vy, Math.max(1, Math.hypot(s.vx, s.vz)));
  s.pitch = approach(s.pitch, path, 2.5, h);
}

/* ============================================================
   Drag, the wall, integration and the ground — shared, because they are
   downstream of a force and a force does not care what made it.

   Takes the airframe: Task 5 hangs the touchdown verdict off the ground
   clamp below, and that verdict is airframe-dependent.
   ============================================================ */
function integrate(s: FlightState, a: Airframe, h: number, groundY: number) {
  /* ---- drag, always opposing the way it is actually going --------- */
  const v = Math.hypot(s.vx, s.vy, s.vz);
  if (v > 0.001) {
    const d = a.CD * v * v;
    s.ax -= (s.vx / v) * d;
    s.ay -= (s.vy / v) * d;
    s.az -= (s.vz / v) * d;
  }

  /* ---- the wall --------------------------------------------------- */
  const over = Math.abs(s.x) - WALL_X;
  if (over > 0) s.ax -= Math.sign(s.x) * over * 4;

  /* ---- integrate --------------------------------------------------- */
  s.vx += s.ax * h;
  s.vy += s.ay * h;
  s.vz += s.az * h;
  s.x += s.vx * h;
  s.y += s.vy * h;
  s.z += s.vz * h;

  /* ---- the ground -------------------------------------------------- */
  /* -0.2 rather than 0: this only fires for a craft that just ARRIVED
     while flying, fast enough that it did not merely settle a few
     hundredths of a unit from float drift. A craft already resting here
     is not in this branch at all — the frame it lands, its mode stops
     being 'flying', and step() routes it to the grounded/spooling/lost
     branches above instead, which return before integrate() is ever
     called again. So there is no repeat-verdict case to guard here; the
     mode switch already took the craft out of this code path. */
  if (s.y < groundY) {
    s.y = groundY;
    if (s.mode === 'flying' && s.vy < -0.2) {
      setMode(s, touchdownVerdict(s, a) === 'landed' ? 'grounded' : 'lost');
      return;
    }
    if (s.vy < 0) s.vy = 0;
  }
  if (s.y > 900) {
    s.y = 900;
    if (s.vy > 0) s.vy = 0;
  }
}
