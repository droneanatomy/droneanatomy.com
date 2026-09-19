'use client';

/* ============================================================
   ClipStage — a Blender-authored take, played real-time.

   The counterpart to the video layer above it: same idea (one beat is a
   five-second loop that runs on a clock, not on scroll), but rendered
   rather than filmed. The point of having both on /preview/trees is to
   judge them side by side on the same page.

   WHAT IS IN THE FILE. `vertical.glb` is the Blender scene reduced for
   the browser: 13,071,275 triangles down to 293,282 and 47.7MB down to
   2.10MB. The terrain was decimated selectively — the aircraft was left
   as authored, because it is only 2.2% of the geometry and all of the
   subject. 38 animation clips survived the trip.

   THE CAMERA IS THE BLENDER CAMERA. It arrives parented as
   Camera <- UP <- "type 7 v39", which is to say it rides the aircraft —
   and that is what makes the take loop. Only five channels actually move:
   the aircraft's translation and four rotor rotations. The land is static
   and the aircraft flies 746.86 units along -Z and then resets; because
   the camera goes with it, the airframe holds still in frame and the LAND
   scrolls past, so the reset is invisible wherever the terrain repeats
   over that distance — which the rendered video proves it does.

   IT IS NOT USED DIRECTLY, THOUGH. The craft node carries scale 33.34 and
   the camera node adds a non-uniform 1.37/1.26/1.48 of its own; UP's 0.01
   cancels most of it, leaving the camera an inherited scale of about 0.46.
   three.js builds the view matrix from the world matrix, so a scaled
   camera scales view space — and znear/zfar with it. The file says
   0.1/1000; at 0.46 that is really 0.05/457 in world units. Rather than
   inherit that quietly, the world position and orientation are copied onto
   an unscaled camera of our own each frame and the planes are set
   explicitly to the values Blender actually rendered with.

   HOW IT LOOPS, which is the whole trick. Only five of the 38 clips
   actually move: the aircraft's translation and four rotor rotations. The
   terrain is static, and the aircraft flies 746.86 units along -Z and
   then resets. Played with a fixed world camera that would be a hard cut.
   Parenting the camera to the aircraft turns it into the shot that was
   rendered: the airframe holds still in frame and the LAND scrolls past,
   so the reset is invisible as long as the terrain repeats over that
   distance — which the rendered video proves it does.
   ============================================================ */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gltfLoader } from './loadCraft';

/* The clip is 120 keys at frames 1..120, so its first key sits at 1/24s
   rather than at zero. Played raw, every loop stalls on the opening pose
   for one frame. Shifting the tracks back by exactly that much puts frame
   1 at t=0 while leaving the duration at 5s, which lets frame 120 hold for
   its own frame before the wrap — the same cadence the video has. */
const FRAME = 1 / 24;

/* The camera node, by its Blender name. */
const CAM_NODE = 'Camera';

/* Blender's yfov, 0.39960 rad. three wants degrees, and its `fov` is the
   VERTICAL angle, which is the same thing glTF stores — so this is a
   straight conversion, not a fit. */
const VFOV = 22.9;

/* The aspect the shot was composed for. Below it the frame is narrower
   than the render, and holding the vertical angle would crop the sides
   off the composition — so the vertical angle is widened instead to keep
   the horizontal extent, which is what object-fit: cover does to the
   video in the layer above. */
const SHOT_ASPECT = 16 / 9;

/* What Blender was really clipping at: the file's 0.1/1000 multiplied by
   the 0.46 the camera inherits. Reproduced rather than widened, because
   the far plane is part of the composition here — the land runs past it
   and there is no horizon in the shot. */
const NEAR = 0.05;
const FAR = 457;

export interface ClipStageProps {
  /* 0 = invisible, 1 = fully up. Written by the caller every frame from
     the same scroll ref the rest of the section reads, so this component
     never subscribes to scroll itself. */
  fadeRef: React.RefObject<number>;
  className?: string;
}

export const ClipStage: React.FC<ClipStageProps> = ({ fadeRef, className }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }
    /* 1.5 rather than 2: this draws a 293k-triangle scene every frame and
       the terrain is a photograph, so the extra samples buy far less here
       than they cost. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(VFOV, SHOT_ASPECT, NEAR, FAR);

    /* The base colour already carries the light the terrain was captured
       under, so this is deliberately flat: a key strong enough to model
       the airframe, and a fill that keeps the land from going to mud.
       Anything more relights ground that is already lit. */
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(-0.4, 1, 0.55);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xd7dee6, 0x5a5348, 1.15));

    /* The Blender camera's NODE — read for its world transform, never
       rendered from, for the scale reason at the top of this file. */
    let shot: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let clipDur = 5;
    let alive = true;

    gltfLoader()
      .loadAsync('/models/vertical.glb')
      .then((gltf) => {
        if (!alive) return;
        scene.add(gltf.scene);
        shot = gltf.scene.getObjectByName(CAM_NODE) ?? null;

        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((clip) => {
          /* See FRAME. Shift, but do NOT let trim/optimise touch the
             duration — the five seconds are what keep this in step with
             the filmed version of the same take. */
          clip.tracks.forEach((t) => t.shift(-FRAME));
          clip.duration = 5;
          clipDur = 5;
          mixer!.clipAction(clip).play();
        });
      })
      .catch(() => {});

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      /* See SHOT_ASPECT. Wider than the render: keep the vertical angle
         and gain sides. Narrower: widen the vertical angle so the
         horizontal angle stays put and the composition survives. */
      camera.fov =
        aspect >= SHOT_ASPECT
          ? VFOV
          : (2 * Math.atan(Math.tan((VFOV * Math.PI) / 360) * (SHOT_ASPECT / aspect)) * 180) /
            Math.PI;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const start = performance.now();
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const fade = fadeRef.current ?? 0;
      /* Nothing to draw, and 293k triangles is not the kind of thing to
         keep drawing four screens away from the viewer. */
      if (fade <= 0.001) return;

      const t = ((performance.now() - start) / 1000) % clipDur;
      mixer?.setTime(t);

      if (shot) {
        /* Position and ORIENTATION, but deliberately not scale. Blender
           authored where this looks and the aircraft carries it along; all
           this does is strip the inherited scale off before handing the
           transform to a camera that would otherwise misread its own
           clipping planes. */
        shot.updateWorldMatrix(true, false);
        shot.getWorldPosition(camPos);
        shot.getWorldQuaternion(camQuat);
        camera.position.copy(camPos);
        camera.quaternion.copy(camQuat);
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mixer?.stopAllAction();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [fadeRef]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
};

export default ClipStage;
