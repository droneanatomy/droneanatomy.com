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
  /** Rotor spool, 0..1. Thrust follows its square, as thrust does. */
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

export function step(s: FlightState, a: Airframe, c: Controls, groundY: number, dt: number): void {
  const h = Math.min(MAX_DT, Math.max(0, dt));
  if (h === 0) return;
  s.since += h;

  if (s.mode !== 'flying') return; // Task 5 fills in the other modes

  const airspeed = Math.hypot(s.vx, s.vy, s.vz);
  s.liftShare = liftShare(airspeed, a);

  /* The two airframes write this frame's accelerations into s.ax/ay/az and
     nothing else; everything downstream of a force is shared. */
  if (a.wing) stepWing(s, a, c, h, airspeed);
  else stepQuad(s, a, c, h, airspeed);

  integrate(s, a, h, groundY);
}

/* ============================================================
   The multirotor.
   ============================================================ */
function stepQuad(s: FlightState, a: Airframe, c: Controls, h: number, airspeed: number) {
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
  const wantClimb = c.lift * a.climb;
  const climbDragFF = a.CD * airspeed * wantClimb;
  const climbAccel = climbDragFF + (wantClimb - s.vy) * 1.6;
  const lean = Math.max(0.3, Math.cos(s.pitch) * Math.cos(s.roll));
  const thrust = Math.min(a.thrustMax, Math.max(0, (G + climbAccel) / lean));

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
function stepWing(s: FlightState, a: Airframe, c: Controls, h: number, airspeed: number) {
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
  const wantClimb = c.lift * a.climb;
  const climbAccel = a.CD * airspeed * wantClimb + (wantClimb - s.vy) * 0.9;
  const demand = G + climbAccel;
  const cosRoll = Math.max(0.2, Math.cos(s.roll));
  /* Tilted lift has to be longer to leave the same amount pointing up,
     which is why a banked turn holds its altitude instead of descending. */
  const needed = demand / cosRoll;

  /* The two lift sources SPLIT the demand rather than both answering it
     in full. Answering it twice is what makes a tiltrotor balloon on its
     way through the window with the stick centred — the mirror image of
     the hole liftShare() exists to prevent, and just as visible. The
     wing can always cover its share: liftShare's own invariant, that
     share * liftThrustMax + CLmax * v^2 exceeds weight, says so. */
  const v2 = airspeed * airspeed;
  const wingShare = (1 - s.liftShare) * needed;
  const CLcmd = v2 > 1 ? Math.min(a.CLmax, Math.max(0, wingShare / v2)) : 0;
  const wingLift = CLcmd * v2;

  /* The lift rotors, while the blend still gives them a share. */
  const rotorLift = s.liftShare * Math.min(a.liftThrustMax, Math.max(0, demand));

  s.ax = fx * thrust + rx * Math.sin(s.roll) * wingLift;
  s.az = fz * thrust + rz * Math.sin(s.roll) * wingLift;
  s.ay = wingLift * cosRoll + rotorLift - G;

  /* The nose follows the flight path, which is what makes a stall LOOK
     like one: lift runs out, the aircraft sinks, and the nose drops
     because the aircraft is now going downwards. */
  const path = Math.atan2(-s.vy, Math.max(1, Math.hypot(s.vx, s.vz)));
  s.pitch = approach(s.pitch, path, 2.5, h);

  /* Yaw follows the velocity for a wing — it goes where it is pointed
     only because it is turning, never because a key said so. */
  if (Math.hypot(s.vx, s.vz) > 5) s.yaw = Math.atan2(-s.vx, -s.vz);
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
  if (s.y < groundY) {
    s.y = groundY;
    if (s.vy < 0) s.vy = 0;
  }
  if (s.y > 900) {
    s.y = 900;
    if (s.vy > 0) s.vy = 0;
  }
}
