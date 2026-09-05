/* ============================================================
   ElasticRig — the camera control, and the reason OrbitControls had to go.

   OrbitControls applies drag deltas straight to its own spherical
   coordinates. There is no hook to attenuate them on the way in, and no
   concept of a pose to return to, so neither half of this control model can
   be expressed by configuring it.

   THE SPRING DOES TWO JOBS AND THAT IS THE WHOLE DESIGN. Flying to a hotspot
   is not a tween — it is `rest` and `pivot` changing, and the same spring
   that snaps a drag back carrying the camera there. So there is no easing
   curve to author, no flight duration to pick, no in-flight state to guard,
   and grabbing the model mid-flight simply works: the drag offset rides on
   top of a rest pose that is still travelling.
   ============================================================ */

import {
  clampPolar,
  elastic,
  poseToPosition,
  springStep,
  type Pose,
  type Vec3,
} from './orbit';
import type * as THREE from 'three';

/* How far a drag can carry the camera off its rest pose, before tanh.
   Azimuth is loose because swinging round the side is the useful gesture;
   polar is tight because under the aircraft reads badly from any angle;
   radius is in FACTOR units and so is proportional by construction — 15% of
   a wide side elevation is a bigger move than 15% of a close-up, which is
   what keeps both feeling the same. */
const LIMIT = { azimuth: 0.9, polar: 0.35, radius: 0.15 };

/* The spring's period. Long enough that a flight across the aircraft has
   weight, short enough that a snap-back is not a journey. */
const PERIOD = 0.55;

/* Radians per second at rest, and it is today's number rather than a new
   one: OrbitControls' autoRotateSpeed of 0.55 works out at 2*PI*0.55/60
   rad/s, about 109 seconds a revolution. */
const DRIFT = 0.0576;

/* The selected pose breathes rather than holding still. Small enough that
   the framing is never lost, large enough that the render is never a
   photograph. Two different periods so the two axes never resolve into an
   obvious loop. */
const SWAY = { azimuth: 0.04, polar: 0.02 };

/* Matches the old rotateSpeed / zoomSpeed. */
const ROTATE = 0.85;
const WHEEL = 0.08;

/* A backgrounded tab hands back multi-second frames and no explicit
   integrator survives one. */
const MAX_DT = 1 / 30;

/* The wheel has no pointerup, so the radius channel needs a timeout to know
   the gesture ended. Long enough to bridge the gap between notches on a
   mouse, short enough that a trackpad flick still springs back promptly. */
const WHEEL_RELEASE_MS = 160;

export type RigOptions = {
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  home: Pose;
  reduced: boolean;
  /** Fired once, the first time the reader takes hold. Drives the hint's
   *  fade and nothing else — the rig itself does not change behaviour. */
  onGrab?: () => void;
};

export class ElasticRig {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly dom: HTMLElement;
  private readonly home: Pose;
  private readonly omega: number;
  private readonly drift: number;
  private readonly sway: { azimuth: number; polar: number };
  private readonly onGrab?: () => void;

  private cur: Pose;
  private vel = { azimuth: 0, polar: 0, radius: 0 };
  private raw = { azimuth: 0, polar: 0, radius: 0 };

  private selectedPose: Pose | null = null;
  private pivot: Vec3 = [0, 0, 0];
  private pivotTarget: Vec3 = [0, 0, 0];
  private pivotVel: Vec3 = [0, 0, 0];

  private fit = 1;
  private driftPhase = 0;
  private clock = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastWheel = -Infinity;
  private grabbed = false;

  constructor(opts: RigOptions) {
    this.camera = opts.camera;
    this.dom = opts.dom;
    this.home = opts.home;
    this.onGrab = opts.onGrab;

    /* Reduced motion kills the autonomous movement and shortens the spring
       so selections arrive rather than travel. The elastic itself stays:
       it answers the reader's own gesture and is not motion they did not
       ask for. */
    this.omega = (2 * Math.PI) / (opts.reduced ? 0.15 : PERIOD);
    this.drift = opts.reduced ? 0 : DRIFT;
    this.sway = opts.reduced ? { azimuth: 0, polar: 0 } : SWAY;

    this.cur = { ...opts.home };

    this.dom.addEventListener('pointerdown', this.onPointerDown);
    this.dom.addEventListener('pointermove', this.onPointerMove);
    this.dom.addEventListener('pointerup', this.onPointerUp);
    this.dom.addEventListener('pointercancel', this.onPointerUp);
    /* Not passive: the wheel means zoom inside this element and the page
       must not also scroll. Outside it the listener does not exist and the
       page scrolls normally, which is the whole arbitration. */
    this.dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** The framing distance frameFor() solved for the current panel aspect.
   *  Poses store factors of this, so a resize re-solves every framing at
   *  once and nothing has to be re-authored per breakpoint. */
  setFit(fit: number) {
    this.fit = fit;
  }

  /** Pass null to return home. */
  select(pose: Pose | null, pivot: Vec3 | null) {
    this.selectedPose = pose;
    this.pivotTarget = pivot ?? [0, 0, 0];
  }

  /** The camera's live spherical pose, for the picker to read off. Factors,
   *  matching what a ViewerPose stores. */
  pose(): Pose {
    return { azimuth: this.cur.azimuth, polar: this.cur.polar, radius: this.cur.radius };
  }

  update(dt: number) {
    const step = Math.min(dt, MAX_DT);
    this.clock += step;

    /* WHERE THE CAMERA WANTS TO BE THIS FRAME.

       Home turns continuously, as it does today. A selected pose sways
       instead, so the framing holds but the render is never static. */
    let rest: Pose;
    if (this.selectedPose) {
      rest = {
        azimuth: this.selectedPose.azimuth + this.sway.azimuth * Math.sin(this.clock / 6),
        polar: this.selectedPose.polar + this.sway.polar * Math.sin(this.clock / 9),
        radius: this.selectedPose.radius,
      };
    } else {
      this.driftPhase += this.drift * step;
      rest = {
        azimuth: this.home.azimuth + this.driftPhase,
        polar: this.home.polar,
        radius: this.home.radius,
      };
    }

    /* The radius is held while the wheel is still turning and released a
       moment after it stops — the wheel's substitute for pointerup. */
    const radiusHeld = this.now() - this.lastWheel < WHEEL_RELEASE_MS;

    if (this.dragging) {
      /* cur is DERIVED from rest while the pointer is down, so a drag that
         starts mid-flight keeps travelling with the rest pose underneath
         it. Velocity is zeroed so the spring does not fight the hand. */
      this.cur.azimuth = rest.azimuth + elastic(this.raw.azimuth, LIMIT.azimuth);
      this.cur.polar = rest.polar + elastic(this.raw.polar, LIMIT.polar);
      this.vel.azimuth = 0;
      this.vel.polar = 0;
    } else {
      /* wrap: true on azimuth only. driftPhase grows without bound, so the
         raw difference between cur and rest can be several revolutions. */
      [this.cur.azimuth, this.vel.azimuth] = springStep(
        this.cur.azimuth,
        this.vel.azimuth,
        rest.azimuth,
        this.omega,
        step,
        true
      );
      [this.cur.polar, this.vel.polar] = springStep(
        this.cur.polar,
        this.vel.polar,
        rest.polar,
        this.omega,
        step
      );
    }

    if (radiusHeld) {
      this.cur.radius = rest.radius + elastic(this.raw.radius, LIMIT.radius * rest.radius);
      this.vel.radius = 0;
    } else {
      this.raw.radius = 0;
      [this.cur.radius, this.vel.radius] = springStep(
        this.cur.radius,
        this.vel.radius,
        rest.radius,
        this.omega,
        step
      );
    }

    this.cur.polar = clampPolar(this.cur.polar);

    /* The pivot springs too, so selecting a hotspot swings the centre of
       rotation onto it rather than cutting to it. */
    for (let i = 0; i < 3; i++) {
      [this.pivot[i], this.pivotVel[i]] = springStep(
        this.pivot[i],
        this.pivotVel[i],
        this.pivotTarget[i],
        this.omega,
        step
      );
    }

    const p = poseToPosition(this.pivot, {
      azimuth: this.cur.azimuth,
      polar: this.cur.polar,
      radius: this.cur.radius * this.fit,
    });
    this.camera.position.set(p[0], p[1], p[2]);
    this.camera.lookAt(this.pivot[0], this.pivot[1], this.pivot[2]);
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
  }

  private now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  private take = () => {
    if (this.grabbed) return;
    this.grabbed = true;
    this.onGrab?.();
  };

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.raw.azimuth = 0;
    this.raw.polar = 0;
    this.dom.setPointerCapture(e.pointerId);
    this.take();
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const h = this.dom.clientHeight || 1;
    /* Signs match OrbitControls, so the gesture means what it has always
       meant here: dragging right turns the model right. */
    this.raw.azimuth -= ((2 * Math.PI * (e.clientX - this.lastX)) / h) * ROTATE;
    this.raw.polar -= ((2 * Math.PI * (e.clientY - this.lastY)) / h) * ROTATE;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    /* cur is left exactly where the drag put it and the spring takes over
       from there, so zeroing raw moves nothing. */
    this.raw.azimuth = 0;
    this.raw.polar = 0;
    if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.lastWheel = this.now();
    this.raw.radius += (e.deltaY / 100) * WHEEL;
    this.take();
  };
}

export default ElasticRig;
