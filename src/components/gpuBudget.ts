/* ============================================================
   gpuBudget — how hard the scenes are allowed to push the GPU.

   The homepage mounts three WebGL contexts (InkReveal, FlightScene,
   TopoSection). All three already pause their render loop when off
   screen, so the cost is not idle work — it is what each one does per
   frame while it IS on screen, and on a low-to-mid phone that is where
   the page stops keeping up.

   The single largest lever is the pixel ratio, because it is quadratic:
   every fragment the renderer shades is paid for twice over when the
   ratio goes up, and a phone's screen is the one place the extra
   resolution buys the least. Hence one number in one file rather than a
   literal at each renderer.

   NOT A DEVICE SNIFF. It asks the same 768px question the rest of the
   site asks — the breakpoint FieldHero, Field.module.css and the mobile
   sections all already turn on — rather than reading a user agent or
   guessing from navigator.hardwareConcurrency. A narrow viewport is not
   a perfect proxy for a weak GPU, but it is the honest one available,
   and it keeps this consistent with every other width decision here.
   ============================================================ */

/* Structurally typed so this module pulls in no three import of its own —
   it needs exactly one method and has no business knowing the rest. */
type HasPixelRatio = { setPixelRatio(value: number): void };

export const isPhone = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

/* 1.25 rather than 1.0.

   Against the 1.75 these scenes used, 1.25 is (1.25/1.75)^2 — a little
   under half the fragments — while 1.0 would be a third of them. The
   extra quarter is kept because these canvases carry thin geometry (the
   dashed flight path, the massif's contour lines) and at 1.0 those edges
   crawl visibly as the camera moves. If phones are still struggling,
   this is the first number to take to 1.0, and it is one edit. */
const PHONE_CAP = 1.25;

/* Called once at renderer construction, as three's own examples do.
   A device that crosses 768px mid-session is a tablet rotating, and
   re-rasterising every target on an orientation change costs more than
   the half-step of sharpness it would buy. */
export function setPixelRatioForDevice(renderer: HasPixelRatio, desktopCap = 1.75) {
  const cap = isPhone() ? PHONE_CAP : desktopCap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
}
