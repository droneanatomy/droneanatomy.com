/* ============================================================
   pickAnchor — how the framings in product.ts get authored.

   DEV ONLY, and gated on NODE_ENV rather than on a URL flag so the whole
   module is dead code in the static export and never ships.

   The alternative was tuning 65 numbers by editing a file and reloading,
   and the real cost of that is not the time — it is that anyone doing it
   stops at "acceptable" rather than at "right". Shift-click the part,
   paste the log.
   ============================================================ */

import * as THREE from 'three';
import type { ElasticRig } from './ElasticRig';

const round = (n: number) => Math.round(n * 1000) / 1000;

export function attachPicker(opts: {
  dom: HTMLElement;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  rig: ElasticRig;
}): () => void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const onClick = (e: MouseEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();

    const r = opts.dom.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, opts.camera);

    const hit = raycaster.intersectObjects(opts.scene.children, true)[0];
    if (!hit) {
      console.log('[pick] nothing under the pointer');
      return;
    }

    /* The face normal is in the hit object's LOCAL space. It has to be
       carried into world space by the normal matrix — not the world matrix
       — or a non-uniform scale anywhere in the chain skews it. loadCraft
       scales uniformly today, but this is the kind of thing that is wrong
       silently and forever once it stops being true. */
    const normal = new THREE.Vector3(0, 0, 1);
    if (hit.face) {
      normal
        .copy(hit.face.normal)
        .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
        .normalize();
    }

    const pose = opts.rig.pose();
    console.log(
      '[pick] %s\n%s',
      hit.object.name || '(unnamed)',
      JSON.stringify(
        {
          anchor: [round(hit.point.x), round(hit.point.y), round(hit.point.z)],
          normal: [round(normal.x), round(normal.y), round(normal.z)],
          pose: {
            azimuth: round(pose.azimuth),
            polar: round(pose.polar),
            radius: round(pose.radius),
          },
        },
        null,
        2
      )
    );
  };

  opts.dom.addEventListener('click', onClick);
  return () => opts.dom.removeEventListener('click', onClick);
}

export default attachPicker;
