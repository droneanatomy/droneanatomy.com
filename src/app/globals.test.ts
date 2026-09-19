import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* GUARDS A SAFARI-ONLY BREAKAGE that no desktop Chrome check will ever see.

   `body { overflow-x: hidden }` breaks every `position: sticky` element on
   the site in WebKit. Chrome propagates body's overflow to the viewport and
   sticky keeps working, so the fault is invisible on the machine the site is
   built on; in Safari the sticky stage scrolls away with the page instead of
   pinning. That took down the flight section's scene machine (its canvas
   left the screen, the IntersectionObserver reported it gone and the render
   loop stopped), the 3D viewer's stage, and the Cyclops film.

   Measured in Playwright WebKit on an iPhone 15 profile, one property changed
   and nothing else: hidden left the flight stage at -1766px and the scene
   stuck on its first card; visible and clip both pinned it at 0 and the
   scene advanced.

   `clip` is the replacement because it keeps the rule's purpose — no
   horizontal scroll from anything wider than the viewport — without making
   body a scroll container. A `hidden` BEFORE it is allowed as the fallback
   for browsers that predate `clip`, which drop the unknown value and keep
   the earlier declaration; what must not happen is `hidden` being the value
   that wins. */

const css = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

/** Every top-level `body { ... }` block, in source order. */
function bodyBlocks(src: string): string[] {
  const out: string[] = [];
  const re = /(^|[\s,}])body\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[2]);
  return out;
}

/** The overflow-x value that wins in a block: the last declaration of it. */
function winningOverflowX(block: string): string | null {
  const decls = [...block.matchAll(/overflow-x\s*:\s*([a-z-]+)/g)].map((d) => d[1]);
  return decls.length ? decls[decls.length - 1] : null;
}

describe('globals.css body overflow', () => {
  it('declares overflow-x on body somewhere, so this test is guarding something real', () => {
    expect(bodyBlocks(css).some((b) => winningOverflowX(b) !== null)).toBe(true);
  });

  it('never lets overflow-x: hidden be the winning value on body (breaks sticky in Safari)', () => {
    for (const block of bodyBlocks(css)) {
      const win = winningOverflowX(block);
      if (win !== null) expect(win).not.toBe('hidden');
    }
  });

  it('uses clip as the winning value wherever body sets overflow-x', () => {
    for (const block of bodyBlocks(css)) {
      const win = winningOverflowX(block);
      if (win !== null) expect(win).toBe('clip');
    }
  });
});
