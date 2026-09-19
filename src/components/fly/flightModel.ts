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
