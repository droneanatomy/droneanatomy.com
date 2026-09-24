'use client';

/* ============================================================
   InkReveal — the hero's visual layer.

   A sheet of marbled ink sits over a still photograph. The cursor
   dissolves a hole in the ink and the photograph shows through, and
   nothing here responds to a click.

   ON TOUCH DEVICES THE HOLE DRIFTS ON ITS OWN, because a phone has no
   cursor to follow: see the frame loop. A finger still takes it over
   while pressed.

   A HOLD DOES, but not in this file: HoldToFly sits alongside this as a
   sibling in the hero and takes a held pointer into the flight sim. It
   never touches the shader, and this stays a pure reveal.

   Everything is one fullscreen fragment shader on a single quad.
   The hidden layer is a plain texture, so the whole effect costs one
   pass — no render targets, no particle system, no second scene.
   That is the entire reason this is affordable: the reference site
   this is modelled on hides a 245k-particle GPU simulation behind its
   ink, and pays for a WebGPU renderer, a fluid solver and two
   ping-pong targets to do it. A photograph needs none of that.

   Three things happen per pixel:

     1. The ink field. Domain-warped fbm, banded into topographic
        contour lines, dried out with grain. Drifts on its own so the
        sheet is alive without a pointer, which is all mobile gets.
     2. The hole. Distance from the cursor, with its edge chewed by
        noise sampled on the unit circle — sampling the raw angle
        would seam at the +/-PI wrap. The ink pattern is then
        subtracted from the hole, so the boundary follows the marbling
        and never reads as a drawn circle.
     3. The composite. Photograph through the hole, paper elsewhere,
        plus vignette and film grain.

   The photograph is never deformed. Only the cover-fit and a rigid
   whole-image parallax touch its UVs; the cursor warp and the click
   ripple act on the ink alone. Anything that displaces the image by
   an amount that varies across it will bulge the aircraft, and the
   aircraft is the product.
   ============================================================ */

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export interface InkRevealProps {
  /* The photograph behind the ink. Reads best with the subject centred
     and well separated from its ground — the hole is only a few hundred
     pixels across, so a busy or very dark frame turns to mush inside it.
     The default is the P10 Pro spraying: bright, aircraft dead centre,
     which is exactly where the cover-fit crop puts it. */
  imageSrc?: string;
  /* Paper and ink.

     The ink is pure black by request, rather than the redesign's #10140b.
     Measured, the difference is 0.89 levels at the default inkDepth —
     below the ~1 level the eye resolves — so this is a deliberate choice
     made with that number in hand, not an expected visual change. It does
     grow with inkDepth (3.85 levels at 0.26), so it matters more if the
     marbling is ever strengthened. */
  paper?: string;
  ink?: string;
  /* Resting reveal, normally 0: the photograph does not show through
     the film at all until the pointer opens a hole, which is how the
     reference behaves. Raising it ghosts the subject through the paper
     before anyone moves — legible, but it muddies the sheet and it was
     the loudest thing on it once the ink was quietened to match the
     reference. The bottom rail's "Move to look through" is what tells
     people there is something to find. */
  ambient?: number;
  /* Radius of the hole, in aspect-corrected screen units. The units are
     tied to the viewport's SHORT edge, so the hole's diameter in pixels
     is roughly 2 * radius * min(width, height) at any aspect. */
  radius?: number;
  /* Gamma applied to the photograph. 1.0 leaves it alone; drop toward
     0.85 to lift a dark source so it reads through a small hole. */
  lift?: number;
  /* How hard the marbling reads against the paper — the sheet's contrast.
     0.06 matches the reference (its whole pattern lives inside a ~5-level
     luminance band). Raising this is what "darker ink" means in practice:
     the ink COLOUR is already near-black, so at these depths changing the
     hue does almost nothing and changing the depth does everything. */
  inkDepth?: number;
  className?: string;
}

export const InkReveal: React.FC<InkRevealProps> = ({
  imageSrc = '/images/hero-ink-p10.webp',
  paper = '#f2ecd9',
  ink = '#000000',
  ambient = 0,
  radius = 0.19,
  lift = 1,
  inkDepth = 0.06,
  className = '',
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    } catch {
      return; // no WebGL: the CSS paper colour underneath stands in
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

    /* 1.5 is the ceiling the reference site uses on retina, and this
       effect is all low-frequency noise — there is nothing at 2x to
       resolve that 1.5x loses, and it costs 1.8x the fragments. */
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    /* Left LINEAR on purpose, and the shader does the encode itself.
       outputColorSpace works by injecting <colorspace_fragment> into the
       fragment shader, and three only ships that include in its BUILT-IN
       materials — a hand-written ShaderMaterial never receives it. So
       setting SRGBColorSpace here looks correct and does nothing, and the
       linear values reach the framebuffer raw: cream #f2ecd9 is
       (0.870, 0.823, 0.681) in linear, which displays as rgb(222,210,174),
       a dull olive. Everything below stays in linear working space and
       lin2srgb() encodes once at the very end, which is exactly what the
       missing include would have done. */
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    const uniforms = {
      uImage: { value: null as THREE.Texture | null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouseUV: { value: new THREE.Vector2(0.5, 0.5) },
      uHover: { value: 0 },
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uRipple: { value: 0 },
      uReady: { value: 0 },
      uImgAspect: { value: 16 / 9 },

      uPaper: { value: new THREE.Color(paper) },
      uInk: { value: new THREE.Color(ink) },
      /* How dark the marbling reads against the paper.

         Set by measurement, not taste. Sampling the reference's sheet
         and box-averaging out its grain puts its whole marbling inside
         a 4.9-level luminance band; at 0.16 ours spanned 16.2, which is
         why the pattern read as a printed texture rather than as a
         suggestion. 0.06 puts ours at the same 4.9 — and lands beside
         the reference's own inkAmbient of 0.05, which is a good sign the
         two parameterisations agree.

         BRIEFLY RAISED BACK TO 0.16 and reverted, which is worth a line
         so it is not tried a third time. The sheet was reading flat and
         near-white, and the marbling was the suspect; strengthening it
         was the wrong lever. What was actually too pale was the PAPER,
         and that is where the fix went — see SCHEMES in InkHero. The
         marbling was in the right neighbourhood all along, exactly as
         the note below says.

         Worth knowing if this is retuned: the marbling turned out NOT to
         be what made our sheet look busy. Measured apart from the grain
         and the vignette it was always in the right neighbourhood. */
      uInkDepth: { value: inkDepth },
      uAmbient: { value: ambient },
      /* Larger on touch. The drifting phone hole is there to SHOW the
         aircraft, not to be chased: at the desktop radius its clear core
         was ~77px across on a 390px screen, a peephole. 1.6x makes it
         about 60% of the width while still reading as a hole in the ink. */
      uRadius: { value: radius * (coarse ? 1.6 : 1) },
      uWarpRadius: { value: 0.34 },
      uWarpStrength: { value: 0.09 },
      uScale: { value: 1.15 },
      uContourFreq: { value: 13.0 },
      uContourThickness: { value: 0.17 },
      uInkResist: { value: 0.34 },
      /* The reference's grain measures 0.98 levels of per-pixel
         deviation. Ours measured 3.47 at 0.045 — three and a half times
         theirs, and once the marbling was brought down to ~5 levels the
         grain was the loudest thing left on the sheet, which is most of
         what read as "busy". 0.013 matches them. Their own trick for
         this is filmGrainUpdateEvery:9, redrawing the grain on every
         ninth frame; a lower amplitude gets to the same place without
         the bookkeeping. */
      uGrain: { value: 0.013 },
      uVignette: { value: 0.5 },
      uParallax: { value: 0.03 },
      uLift: { value: lift },
    };

    const loader = new THREE.TextureLoader();
    loader.load(
      imageSrc,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        uniforms.uImage.value = t;
        if (t.image) uniforms.uImgAspect.value = t.image.width / t.image.height;
      },
      undefined,
      () => {
        /* Leave uReady at 0. The hole then opens onto black, which is
           wrong-looking but not broken, and the paper still renders. */
      }
    );

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;

        uniform sampler2D uImage;
        uniform vec2  uRes, uMouseUV;
        uniform float uHover, uTime, uScroll, uRipple, uReady, uImgAspect;
        uniform vec3  uPaper, uInk;
        uniform float uInkDepth, uAmbient, uRadius, uWarpRadius, uWarpStrength;
        uniform float uScale, uContourFreq, uContourThickness, uInkResist;
        uniform float uGrain, uVignette, uParallax, uLift;

        float hash(vec2 p){
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        /* Five octaves for the sheet, three for the hole's edge. Fixed
           counts because GLSL ES 1.00 needs constant loop bounds. */
        float fbm5(vec2 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
          return v;
        }

        float fbm3(vec2 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        /* The sRGB transfer function, piecewise as three writes it. Every
           colour in this shader is linear — THREE.Color decodes hex on the
           way in, and sRGB textures are decoded by the sampler — so this
           runs exactly once, on the final pixel. */
        vec3 lin2srgb(vec3 c){
          c = clamp(c, 0.0, 1.0);
          return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055,
                     c * 12.92,
                     vec3(lessThanEqual(c, vec3(0.0031308))));
        }

        void main(){
          float viewAspect = uRes.x / uRes.y;

          /* Pointer vector, corrected so the hole is round on any
             aspect rather than an ellipse. */
          vec2  d    = vUv - uMouseUV;
          d.x       *= viewAspect;
          float dist = length(d);
          vec2  dir  = dist > 1e-5 ? d / dist : vec2(0.0);

          /* Click ripple: a ring travelling outward, shoving both the
             ink and the photograph as it passes, fading as it goes.

             The envelope is NOT optional. At rest uRipple is 0, which
             puts ringR at 0 and makes the leading smoothstep read
             smoothstep(-0.18, 0.0, dist) — that returns 1 for every
             dist >= 0, so the ring degenerates into a filled disc and
             leaves a permanent 0.03-UV radial push centred on the
             cursor. Applied to the photograph that is a lens: the image
             bulges wherever the hole is, which is the one place anyone
             is looking. 4r(1-r) is zero at both ends of the ripple's
             life and peaks mid-travel, so nothing displaces until a
             click actually happens. */
          float ringR = uRipple * 1.15;
          float env   = 4.0 * uRipple * (1.0 - uRipple);
          float ring  = smoothstep(ringR - 0.18, ringR, dist) *
                        (1.0 - smoothstep(ringR, ringR + 0.18, dist));
          vec2  shove = dir * ring * env * 0.030;

          /* ---------- 1. the ink sheet ---------- */

          vec2 p = vUv * vec2(viewAspect, 1.0) / uScale;
          p.y += uScroll * 1.4;          // the sheet slides as the page moves
          p   += shove / uScale;

          // the cursor pushes the marbling aside ahead of the hole
          float wr   = uWarpRadius * min(1.0, viewAspect);
          float warp = exp(-(dist * dist) / (wr * wr));
          p += dir * warp * uWarpStrength * uHover;

          /* 0.15, down from 0.5. Sampling the same pixels on the
             reference two seconds apart moves them 1.44 levels on
             average; ours moved 4.89. The sheet should read as barely
             alive, not as flowing liquid. */
          float t = uTime * 0.15;

          vec2 q = vec2(fbm5(p + vec2(0.0, t * 0.12)),
                        fbm5(p + vec2(5.2, 1.3)));
          vec2 r = vec2(fbm5(p + 2.40 * q + vec2(1.7, 9.2) + t * 0.09),
                        fbm5(p + 2.40 * q + vec2(8.3, 2.8) - t * 0.07));
          float f = fbm5(p + 2.27 * r);

          /* Contour lines. A triangle wave through the field puts a
             thin band at every level crossing, which is what gives the
             sheet its topographic, poured-ink look. */
          float tri   = abs(fract(f * uContourFreq) - 0.5) * 2.0;
          float lines = 1.0 - smoothstep(0.0, uContourThickness, tri);

          float grain = hash(vUv * uRes * 0.5 + fract(uTime) * 91.7);

          float ink = clamp(f * 0.65 + lines * 0.55, 0.0, 1.0);
          ink = clamp((ink - 0.5) * 2.44 + 0.5, 0.0, 1.0);       // contrast
          ink = mix(ink, ink * (0.85 + grain * 0.30), 0.35);     // dry brush

          /* ---------- 2. the hole ---------- */

          /* Sampled on the unit circle so the lobes wrap seamlessly. */
          float ang  = atan(d.y, d.x);
          float lobe = fbm3(vec2(cos(ang), sin(ang)) * 4.0 + uTime * 0.22);

          /* Aspect-correcting d.x makes the hole round, but it also ties
             its diameter to viewport HEIGHT in both axes — so a radius
             tuned on a 1440x900 desktop comes out 338px across on a
             252x563 phone, wider than the screen. Scaling by the aspect
             below 1 re-references it to the short edge on portrait and
             leaves landscape untouched. */
          float fit    = min(1.0, viewAspect);
          float radius = uRadius * fit * (0.78 + lobe * 0.60);

          float fray = fbm3(d * 11.0 + uTime * 0.06) - 0.5;
          float rd   = dist + fray * uRadius * fit * 0.22;

          /* A tight falloff. The first cut used radius*0.18 as the inner
             edge, which spread the boundary over four-fifths of the hole
             and read as an airbrushed vignette rather than a tear —
             invisible against a dark photograph, obvious against a
             bright one. The noise above is what should be shaping this
             edge, and it cannot if the gradient is wider than the noise. */
          float reveal = 1.0 - smoothstep(radius * 0.52, radius, rd);
          reveal = clamp(reveal, 0.0, 1.0) * uHover;
          reveal = max(reveal, uAmbient);


          /* The marbling resists the hole. Subtracting it here is what
             makes the boundary tear along the ink instead of cutting a
             circle through it. */
          float open = smoothstep(0.0, 0.40, reveal - ink * uInkResist);

          /* ---------- 3. the composite ---------- */

          // cover-fit the photograph without distorting it
          vec2 uv = vUv;
          if (viewAspect > uImgAspect) {
            uv.y = (uv.y - 0.5) * (uImgAspect / viewAspect) + 0.5;
          } else {
            uv.x = (uv.x - 0.5) * (viewAspect / uImgAspect) + 0.5;
          }
          /* Parallax only. The click ripple deliberately does NOT reach
             these UVs: it is a radially-varying displacement, so letting
             it through would bend the photograph every time someone
             clicks. It still travels through the ink above (see p), so
             the paper ripples and the picture underneath stays rigid. */
          uv += (uMouseUV - 0.5) * uParallax * uHover;

          /* One straight sample. There was a chromatic-aberration pass
             here, splitting R and B along the pointer vector by up to
             two pixels at the tear — the reference does the same, and it
             does read as film. But it is still a per-channel
             misregistration of the photograph, and the photograph is the
             product. Nothing displaces the image now: the only thing
             touching these UVs is the rigid cover-fit and a whole-image
             parallax drift, neither of which deforms it. */
          vec3 img = texture2D(uImage, uv).rgb;

          /* Midtone lift for dark source images. A night frame seen
             through a small hole in bright paper reads as a black
             smudge at its native exposure; a daylight frame needs
             nothing. uLift is a gamma, so 1.0 is a no-op and the
             highlights are never pushed regardless. */
          img = pow(img, vec3(uLift)) * uReady;

          vec3 paperCol = mix(uPaper, uInk, ink * uInkDepth);
          vec3 col      = mix(paperCol, img, open);

          /* The vignette belongs to the photograph, not to the paper. At
             full strength on cream it reads as a dirty olive gradient
             rather than as falloff, so the sheet keeps only a token
             share of it and the revealed image takes the rest.

             That share started at 0.18, darkening the sheet's edges by
             8.4 levels. Measured, the reference's sheet darkens by 0.2 —
             it has a vignette, but it is applied to the scene behind the
             ink, not to the paper. So the paper's share is essentially
             nil, and the hole carries the whole effect. */
          vec2  vd  = (vUv - 0.5) * vec2(viewAspect, 1.0);
          float vig = smoothstep(0.35, 1.05, length(vd));
          col *= 1.0 - uVignette * vig * (0.006 + 0.994 * open);

          col = lin2srgb(col);

          /* Grain is added AFTER the encode, in display space. Added in
             linear it is swamped in the highlights and screams in the
             shadows, because the transfer curve is steepest near black. */
          col += (grain - 0.5) * uGrain;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const scene = new THREE.Scene();
    const cam = new THREE.Camera();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    /* ---------- pointer ---------- */

    const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, hover: 0, thover: 0 };
    let rippleStart = -1;

    /* A finger is on the glass. On touch devices the hole DRIFTS on its
       own whenever this is false — see the frame loop. */
    let touching = false;

    const track = (e: PointerEvent) => {
      const b = wrap.getBoundingClientRect();
      ptr.tx = (e.clientX - b.left) / b.width;
      ptr.ty = 1 - (e.clientY - b.top) / b.height;
      ptr.thover = 1;
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') touching = true;
      track(e);
      if (!reduced) rippleStart = performance.now();
    };
    /* A mouse keeps the hole open until it leaves the section. A finger
       hands the hole back to the drift when it lifts — it used to close
       it, and a touch hole that only exists while pressed is one no
       phone visitor ever sees: any swipe is taken as a scroll and
       cancelled at once. */
    const onUp = () => {
      touching = false;
    };
    const onLeave = () => {
      ptr.thover = 0;
    };

    wrap.addEventListener('pointermove', track);
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointerup', onUp);
    wrap.addEventListener('pointercancel', onUp);
    wrap.addEventListener('pointerleave', onLeave);

    /* ---------- viewport ---------- */

    let inView = true;
    const io = new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, {
      threshold: 0.01,
    });
    io.observe(wrap);

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const clock = new THREE.Clock();
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!inView) return;

      /* One read of the clock per frame. getElapsedTime() and getDelta()
         BOTH advance the clock's internal marker, so calling them both in
         the same frame makes each return half the true interval — the
         drift animation would run at half speed and the fade would take
         twice as long. Take the delta and accumulate. */
      const frameDt = Math.min(0.1, clock.getDelta());
      if (!reduced) uniforms.uTime.value += frameDt;
      uniforms.uScroll.value = window.scrollY / Math.max(1, window.innerHeight);

      /* Ease the pointer so the hole trails the cursor instead of
         snapping — PER SECOND, not per frame.

         These were 0.09 and 0.07 of the remaining distance every frame,
         which silently ties the feel to the refresh rate: a 120Hz
         display converges twice as fast as a 60Hz one, and on anything
         slower the hole never quite arrives. The exponential form is
         the same filter expressed against real time; the constants are
         the old values' time constants at 60fps, so the feel is
         unchanged where it was already being designed. */
      /* TOUCH HAS NO HOVER, so on a phone the hole moves itself.

         Without this the hero on a phone was a plain sheet of paper and
         a headline: the photograph only showed while a finger was held
         down, and a finger that moves is a scroll. Now, whenever nobody
         is touching it, the hole wanders a slow Lissajous loop around the
         middle of the frame — where the aircraft sits in the cover-fit
         photo — so the page shows what it is about without asking for a
         gesture nobody makes on a phone. Two incommensurate periods, so
         the path never visibly repeats.

         Under reduced motion uTime does not advance, so this settles to
         one fixed point near the centre: the photo is still revealed,
         it just does not move. */
      if (coarse && !touching) {
        const t = uniforms.uTime.value;
        ptr.tx = 0.5 + Math.sin(t * 0.52) * 0.2;
        ptr.ty = 0.52 + Math.sin(t * 0.37 + 1.3) * 0.15;
        ptr.thover = 1;
      }

      const kPos = 1 - Math.exp(-frameDt / 0.177);
      const kHover = 1 - Math.exp(-frameDt / 0.23);
      ptr.x += (ptr.tx - ptr.x) * kPos;
      ptr.y += (ptr.ty - ptr.y) * kPos;
      ptr.hover += (ptr.thover - ptr.hover) * kHover;
      uniforms.uMouseUV.value.set(ptr.x, ptr.y);
      uniforms.uHover.value = ptr.hover;

      if (rippleStart > 0) {
        const k = (performance.now() - rippleStart) / 900;
        if (k >= 1) {
          rippleStart = -1;
          uniforms.uRipple.value = 0;
        } else {
          uniforms.uRipple.value = k;
        }
      }

      /* Fade the photograph in once decoded, so it never pops.

         Per SECOND, not per frame. At 0.03 a frame this took 33 frames,
         which is half a second at 60fps and over half a MINUTE on a
         device rendering at 1fps — the photograph sat visibly dim through
         the whole first interaction. Tying a fade to frame count makes
         its duration a function of how fast the machine is, which is
         exactly backwards. */
      if (uniforms.uImage.value && uniforms.uReady.value < 1) {
        uniforms.uReady.value = Math.min(1, uniforms.uReady.value + frameDt / 0.45);
      }

      renderer.render(scene, cam);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      wrap.removeEventListener('pointermove', track);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointerup', onUp);
      wrap.removeEventListener('pointercancel', onUp);
      wrap.removeEventListener('pointerleave', onLeave);
      io.disconnect();
      quad.geometry.dispose();
      material.dispose();
      uniforms.uImage.value?.dispose();
      renderer.dispose();
    };
  }, [imageSrc, paper, ink, ambient, radius, lift, inkDepth]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'absolute', inset: 0, background: paper }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

export default InkReveal;
