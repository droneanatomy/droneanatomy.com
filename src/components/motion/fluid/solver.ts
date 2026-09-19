/* Minimal WebGL2 stable-fluids solver.

   Deliberately framework-free: raw WebGL2 rather than Three.js, because this
   is a chain of ping-ponged fullscreen passes over float render targets and
   Three's scene abstraction only gets in the way.

   Requires EXT_color_buffer_float (or _half_float) to render to float
   textures. `create()` returns null when unavailable so the caller can skip
   the effect rather than crash.
*/

import {
  VERT,
  ADVECTION,
  DIVERGENCE,
  CURL,
  VORTICITY,
  PRESSURE,
  GRADIENT_SUBTRACT,
  SPLAT,
  DISPLAY,
} from './shaders';

export interface FluidConfig {
  /** Simulation grid resolution for velocity. Lower is faster. */
  simRes: number;
  /** Dye (visible trail) resolution. */
  dyeRes: number;
  /** How fast velocity decays. Higher = trail stops sooner. */
  velocityDissipation: number;
  /** How fast the visible dye fades. */
  densityDissipation: number;
  /** Vorticity confinement strength — the "swirliness". */
  curl: number;
  /** Splat size. */
  radius: number;
  /** Jacobi iterations for the pressure solve. */
  pressureIterations: number;
}

export const DEFAULT_CONFIG: FluidConfig = {
  simRes: 128,
  dyeRes: 512,
  /* Low dissipation so the trail keeps moving and curling after the pointer
     has passed, rather than snapping off behind the cursor. */
  velocityDissipation: 1.4,
  densityDissipation: 1.1,
  curl: 32,
  radius: 0.0009,
  pressureIterations: 20,
};

interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach(id: number): number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  swap(): void;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[fluid] shader compile failed:', gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function program(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aPosition');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[fluid] program link failed:', gl.getProgramInfoLog(p));
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return p;
}

function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram) {
  const map: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i)!.name;
    const loc = gl.getUniformLocation(p, name);
    if (loc) map[name] = loc;
  }
  return map;
}

export interface Fluid {
  resize(width: number, height: number, dpr: number): void;
  splat(x: number, y: number, dx: number, dy: number, color: [number, number, number]): void;
  step(dt: number): void;
  render(): void;
  setAppearance(tint: [number, number, number], polarity: number, strength: number): void;
  dispose(): void;
  /** Diagnostics: framebuffer completeness, GL errors, and peak dye value. */
  debug(): Record<string, unknown>;
  /** Renders and reads the canvas back in the same task. */
  renderAndPeek(): Record<string, unknown>;
}

export function createFluid(
  canvas: HTMLCanvasElement,
  cfg: FluidConfig = DEFAULT_CONFIG
): Fluid | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  // Rendering to float targets is an extension even in WebGL2.
  const linearFloat = gl.getExtension('OES_texture_float_linear');
  const colorFloat =
    gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  if (!colorFloat) return null;

  const texType = gl.HALF_FLOAT;
  const filtering = linearFloat ? gl.LINEAR : gl.NEAREST;

  const programs = {
    advection: program(gl, VERT, ADVECTION),
    divergence: program(gl, VERT, DIVERGENCE),
    curl: program(gl, VERT, CURL),
    vorticity: program(gl, VERT, VORTICITY),
    pressure: program(gl, VERT, PRESSURE),
    gradient: program(gl, VERT, GRADIENT_SUBTRACT),
    splat: program(gl, VERT, SPLAT),
    display: program(gl, VERT, DISPLAY),
  };
  if (Object.values(programs).some((p) => !p)) return null;

  const u = {
    advection: uniforms(gl, programs.advection!),
    divergence: uniforms(gl, programs.divergence!),
    curl: uniforms(gl, programs.curl!),
    vorticity: uniforms(gl, programs.vorticity!),
    pressure: uniforms(gl, programs.pressure!),
    gradient: uniforms(gl, programs.gradient!),
    splat: uniforms(gl, programs.splat!),
    display: uniforms(gl, programs.display!),
  };

  // Fullscreen quad.
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const draw = (target: FBO | null) => {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    } else {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  function createFBO(w: number, h: number, internal: number, format: number, filter: number): FBO {
    const texture = gl!.createTexture()!;
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, filter);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, internal, w, h, 0, format, texType, null);

    const fbo = gl!.createFramebuffer()!;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, texture, 0);
    gl!.viewport(0, 0, w, h);
    gl!.clear(gl!.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      attach(id: number) {
        gl!.activeTexture(gl!.TEXTURE0 + id);
        gl!.bindTexture(gl!.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  function createDouble(w: number, h: number, internal: number, format: number, filter: number): DoubleFBO {
    let fbo1 = createFBO(w, h, internal, format, filter);
    let fbo2 = createFBO(w, h, internal, format, filter);
    return {
      width: w,
      height: h,
      texelSizeX: 1 / w,
      texelSizeY: 1 / h,
      get read() { return fbo1; },
      set read(v) { fbo1 = v; },
      get write() { return fbo2; },
      set write(v) { fbo2 = v; },
      swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
    };
  }

  let dye: DoubleFBO;
  let velocity: DoubleFBO;
  let divergenceFBO: FBO;
  let curlFBO: FBO;
  let pressure: DoubleFBO;
  let aspect = 1;

  function initFramebuffers(width: number, height: number) {
    aspect = width / height;
    const simH = Math.round(cfg.simRes);
    const simW = Math.round(simH * aspect);
    const dyeH = Math.round(cfg.dyeRes);
    const dyeW = Math.round(dyeH * aspect);

    const rgba = gl!.RGBA16F;
    const rg = gl!.RG16F;
    const r = gl!.R16F;

    dye = createDouble(dyeW, dyeH, rgba, gl!.RGBA, filtering);
    velocity = createDouble(simW, simH, rg, gl!.RG, filtering);
    divergenceFBO = createFBO(simW, simH, r, gl!.RED, gl!.NEAREST);
    curlFBO = createFBO(simW, simH, r, gl!.RED, gl!.NEAREST);
    pressure = createDouble(simW, simH, r, gl!.RED, gl!.NEAREST);
  }

  initFramebuffers(canvas.width || 1, canvas.height || 1);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  const appearance = {
    tint: [0.5, 0.5, 0.5] as [number, number, number],
    polarity: 1,
    strength: 1,
  };

  const setTexel = (map: Record<string, WebGLUniformLocation>, t: { texelSizeX: number; texelSizeY: number }) => {
    if (map.uTexelSize) gl.uniform2f(map.uTexelSize, t.texelSizeX, t.texelSizeY);
  };

  return {
    resize(width, height, dpr) {
      const w = Math.max(1, Math.floor(width * dpr));
      const h = Math.max(1, Math.floor(height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      initFramebuffers(w, h);
    },

    splat(x, y, dx, dy, color) {
      gl.useProgram(programs.splat!);
      setTexel(u.splat, velocity);
      gl.uniform1i(u.splat.uTarget, velocity.read.attach(0));
      gl.uniform1f(u.splat.uAspect, aspect);
      gl.uniform2f(u.splat.uPoint, x, y);
      gl.uniform3f(u.splat.uColor, dx, dy, 0);
      gl.uniform1f(u.splat.uRadius, cfg.radius);
      draw(velocity.write);
      velocity.swap();

      setTexel(u.splat, dye);
      gl.uniform1i(u.splat.uTarget, dye.read.attach(0));
      gl.uniform3f(u.splat.uColor, color[0], color[1], color[2]);
      draw(dye.write);
      dye.swap();
    },

    step(dt) {
      gl.disable(gl.BLEND);

      // curl
      gl.useProgram(programs.curl!);
      setTexel(u.curl, velocity);
      gl.uniform1i(u.curl.uVelocity, velocity.read.attach(0));
      draw(curlFBO);

      // vorticity confinement
      gl.useProgram(programs.vorticity!);
      setTexel(u.vorticity, velocity);
      gl.uniform1i(u.vorticity.uVelocity, velocity.read.attach(0));
      gl.uniform1i(u.vorticity.uCurl, curlFBO.attach(1));
      gl.uniform1f(u.vorticity.uCurlStrength, cfg.curl);
      gl.uniform1f(u.vorticity.uDt, dt);
      draw(velocity.write);
      velocity.swap();

      // divergence
      gl.useProgram(programs.divergence!);
      setTexel(u.divergence, velocity);
      gl.uniform1i(u.divergence.uVelocity, velocity.read.attach(0));
      draw(divergenceFBO);

      // pressure solve
      gl.useProgram(programs.pressure!);
      setTexel(u.pressure, velocity);
      gl.uniform1i(u.pressure.uDivergence, divergenceFBO.attach(0));
      for (let i = 0; i < cfg.pressureIterations; i++) {
        gl.uniform1i(u.pressure.uPressure, pressure.read.attach(1));
        draw(pressure.write);
        pressure.swap();
      }

      // make velocity divergence-free
      gl.useProgram(programs.gradient!);
      setTexel(u.gradient, velocity);
      gl.uniform1i(u.gradient.uPressure, pressure.read.attach(0));
      gl.uniform1i(u.gradient.uVelocity, velocity.read.attach(1));
      draw(velocity.write);
      velocity.swap();

      // advect velocity, then dye
      gl.useProgram(programs.advection!);
      setTexel(u.advection, velocity);
      gl.uniform1i(u.advection.uVelocity, velocity.read.attach(0));
      gl.uniform1i(u.advection.uSource, velocity.read.attach(0));
      gl.uniform1f(u.advection.uDt, dt);
      gl.uniform1f(u.advection.uDissipation, cfg.velocityDissipation);
      draw(velocity.write);
      velocity.swap();

      setTexel(u.advection, dye);
      gl.uniform1i(u.advection.uVelocity, velocity.read.attach(0));
      gl.uniform1i(u.advection.uSource, dye.read.attach(1));
      gl.uniform1f(u.advection.uDissipation, cfg.densityDissipation);
      draw(dye.write);
      dye.swap();
    },

    /* Appearance is set by the host each frame from the page's own colours, so
       the lens tracks the light-to-dark arc instead of fighting it. */
    setAppearance(tint: [number, number, number], polarity: number, strength: number) {
      appearance.tint = tint;
      appearance.polarity = polarity;
      appearance.strength = strength;
    },

    render() {
      /* Bind the default framebuffer BEFORE clearing. step() leaves dye.write
         bound, so clearing first wipes the dye texture that was just
         simulated and the canvas receives an empty field. */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

      /* No blending: the buffer was just cleared to transparent and the
         display shader emits straight (non-premultiplied) RGBA, matching the
         context's premultipliedAlpha:false. */
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(programs.display!);
      setTexel(u.display, dye);
      gl.uniform1i(u.display.uTexture, dye.read.attach(0));
      if (u.display.uTint) gl.uniform3fv(u.display.uTint, appearance.tint);
      if (u.display.uPolarity) gl.uniform1f(u.display.uPolarity, appearance.polarity);
      if (u.display.uStrength) gl.uniform1f(u.display.uStrength, appearance.strength);
      draw(null);
    },

    /* Renders, then immediately reads the default framebuffer back. Must
       happen in one task: the drawing buffer is not preserved. */
    renderAndPeek() {
      this.render();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const px = new Uint8Array(4 * 64 * 64);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(
        Math.floor(w / 2) - 32, Math.floor(h / 2) - 32, 64, 64,
        gl.RGBA, gl.UNSIGNED_BYTE, px
      );
      let maxRGB = 0;
      let maxA = 0;
      for (let i = 0; i < px.length; i += 4) {
        maxRGB = Math.max(maxRGB, px[i], px[i + 1], px[i + 2]);
        maxA = Math.max(maxA, px[i + 3]);
      }
      return { drawingBuffer: `${w}x${h}`, maxRGB, maxAlpha: maxA, glError: gl.getError() };
    },

    debug() {
      const statusName = (s: number) =>
        ({
          [gl.FRAMEBUFFER_COMPLETE]: 'COMPLETE',
          [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'INCOMPLETE_ATTACHMENT',
          [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'MISSING_ATTACHMENT',
          [gl.FRAMEBUFFER_UNSUPPORTED]: 'UNSUPPORTED',
        }[s] ?? `0x${s.toString(16)}`);

      const check = (f: FBO) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
        return statusName(gl.checkFramebufferStatus(gl.FRAMEBUFFER));
      };

      /* Sample the CENTRE of the dye field, not the corner — splats land mid
         canvas, so a corner read reports 0 even when the sim is working. */
      gl.bindFramebuffer(gl.FRAMEBUFFER, dye.read.fbo);
      const w = Math.min(dye.read.width, 128);
      const h = Math.min(dye.read.height, 128);
      const ox = Math.max(0, Math.floor((dye.read.width - w) / 2));
      const oy = Math.max(0, Math.floor((dye.read.height - h) / 2));
      let peak = -1;
      let readErr: string | null = null;
      try {
        const px = new Float32Array(w * h * 4);
        gl.readPixels(ox, oy, w, h, gl.RGBA, gl.FLOAT, px);
        for (let i = 0; i < px.length; i++) if (px[i] > peak) peak = px[i];
      } catch (e) {
        readErr = String(e);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      return {
        glError: gl.getError(),
        dyeStatus: check(dye.read),
        velocityStatus: check(velocity.read),
        pressureStatus: check(pressure.read),
        curlStatus: check(curlFBO),
        dyeSize: `${dye.read.width}x${dye.read.height}`,
        velocitySize: `${velocity.read.width}x${velocity.read.height}`,
        canvasSize: `${canvas.width}x${canvas.height}`,
        peakDye: peak,
        readErr,
      };
    },

    dispose() {
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    },
  };
}
