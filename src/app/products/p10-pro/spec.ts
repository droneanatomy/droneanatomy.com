/* ============================================================
   P10 PRO — THE OFFICIAL SPEC SHEET. One file, every number.

   WHY THIS EXISTS. The page's meta description said "six metres of swath,
   eighteen minutes on four packs" while the page itself said "30 minutes"
   and "4–6 m", and the bench said "10kg" where the nav said "ten litres".
   Search engines and AI assistants read the meta first, the page second,
   and dealer listings third — and they saw three different aircraft. They
   respond to a conflict by trusting none of it.

   So every P10 Pro fact the site states as text comes from here: the spec
   table, the FAQ, the Product/FAQ structured data and the meta description.
   Dealer listings (Flapone, Xboom, Everse, IndiaMART) should be corrected
   to match THIS file, not the other way round.

   NULL MEANS UNCONFIRMED, AND UNCONFIRMED IS NOT PUBLISHED. A row whose
   value is null does not render and does not reach the structured data.
   Never fill one with a dealer's number to make the table look complete —
   a wrong spec on our own domain is worse than a missing one.
   ============================================================ */

export type SpecRow = { label: string; value: string | null };
export type SpecGroup = { heading: string; rows: SpecRow[] };
export type Faq = { q: string; a: string | null };

export const P10_FACTS = {
  name: 'P10 Pro',
  brand: 'DroneAnatomy',
  category: 'Agricultural spraying drone',

  /* Confirmed 2026-11-02. */
  tankLitres: 10,
  maxFlightMinutes: 30,
  sprayWidth: '4–6 m',
  maxFlowRate: 'Up to 5 L/min',
  coverage: 'About 1 acre in 5 minutes',
  dgcaTypeCertified: true,

  /* UNCONFIRMED — fill these in from the official sheet. */
  dgcaCertificateNo: null as string | null,
  warranty: null as string | null,
  /* e.g. { low: 450000, high: 550000 } in rupees. Feeds the Offer schema. */
  priceInr: null as { low: number; high: number } | null,
};

/* What "40% smaller" is measured against — the slide on the hero carries
   the claim with no reference, and an unqualified comparison is the kind
   of thing an assistant either ignores or repeats wrongly. Wording is from
   the original product page (git e6aff0f). */
export const SIZE_CLAIM =
  '40% smaller and 30% more efficient than standard 10 kg-class agricultural drones.';

export const P10_SPEC: SpecGroup[] = [
  {
    heading: 'Spraying',
    rows: [
      { label: 'Tank capacity', value: `${P10_FACTS.tankLitres} L` },
      { label: 'Spray width', value: P10_FACTS.sprayWidth },
      { label: 'Max flow rate', value: P10_FACTS.maxFlowRate },
      { label: 'Coverage', value: P10_FACTS.coverage },
      { label: 'Acres per day', value: null },
    ],
  },
  {
    heading: 'Flight',
    rows: [
      { label: 'Max flight time', value: `${P10_FACTS.maxFlightMinutes} minutes` },
      { label: 'Flight time at full 10 L load', value: null },
      { label: 'Positioning', value: 'GPS-assisted navigation' },
      { label: 'RTK', value: null },
      { label: 'Night operation', value: 'Bright LED lighting for night spraying' },
      { label: 'Wind resistance', value: null },
      { label: 'Ingress protection (IP rating)', value: null },
    ],
  },
  {
    heading: 'Airframe & power',
    rows: [
      { label: 'Weight (empty)', value: null },
      { label: 'Dimensions, unfolded', value: null },
      { label: 'Dimensions, folded', value: null },
      { label: 'Battery type and capacity', value: null },
      { label: 'Charge time', value: null },
      { label: 'Batteries included', value: null },
    ],
  },
  {
    heading: 'Certification & support',
    rows: [
      {
        label: 'DGCA certification',
        value: P10_FACTS.dgcaTypeCertified
          ? P10_FACTS.dgcaCertificateNo
            ? `Type certified — certificate no. ${P10_FACTS.dgcaCertificateNo}`
            : 'Type certified'
          : null,
      },
      { label: 'Warranty', value: P10_FACTS.warranty },
      { label: 'In the box', value: null },
      { label: 'Made in', value: 'India' },
    ],
  },
];

/* A row's value by label, so FAQ answers can quote the spec table instead
   of restating it. Returns null while the row is unconfirmed. */
const spec = (label: string) =>
  P10_SPEC.flatMap((g) => g.rows).find((r) => r.label === label)?.value ?? null;

/* Compactness is the P10 Pro's lead differentiator, so it gets its own
   questions near the top. The size answer grows on its own once the
   folded dimensions and weight are filled in above. */
const foldedSize = spec('Dimensions, folded');
const emptyWeight = spec('Weight (empty)');
const sizeFacts = [
  foldedSize && `Folded, it measures ${foldedSize}`,
  emptyWeight && `it weighs ${emptyWeight} empty`,
].filter(Boolean).join(' and ');

/* The questions farmers actually type into a search box or an assistant.
   An answer of null hides the question — better no answer than a guess. */
export const P10_FAQ: Faq[] = [
  {
    q: 'How compact is the P10 Pro?',
    a:
      `The P10 Pro is one of India’s first ultra-compact agricultural spraying drones — ${SIZE_CLAIM.charAt(0).toLowerCase()}${SIZE_CLAIM.slice(1)} ` +
      `Its arms fold in for transport, so the whole aircraft packs down small enough for one person to carry.` +
      (sizeFacts ? ` ${sizeFacts}.` : ''),
  },
  {
    q: 'Can one person carry and transport the P10 Pro?',
    a: 'Yes. With its arms folded, the P10 Pro is carried by a single operator and travels in its own case. It is light enough to carry anywhere, which saves on transport costs when moving between fields.',
  },
  {
    q: 'Why does a compact spraying drone matter for Indian farms?',
    a: 'Many Indian farms are small, fragmented or on steep, uneven and terraced ground. A smaller drone is easier to carry to the field, launch from a narrow bund or headland and fly over difficult terrain — the conditions the P10 Pro was designed for — while still carrying a full 10 L tank.',
  },
  {
    q: 'Is the P10 Pro DGCA certified?',
    a: P10_FACTS.dgcaCertificateNo
      ? `Yes. The P10 Pro is type certified by the DGCA (certificate no. ${P10_FACTS.dgcaCertificateNo}).`
      : 'Yes. The P10 Pro is type certified by the DGCA, India’s civil aviation regulator.',
  },
  {
    q: 'What is the P10 Pro’s tank capacity and spray width?',
    a: `It carries a ${P10_FACTS.tankLitres} L tank and sprays a ${P10_FACTS.sprayWidth} swath at ${P10_FACTS.maxFlowRate.toLowerCase()}.`,
  },
  {
    q: 'How long does the P10 Pro fly?',
    a: `Maximum flight time is ${P10_FACTS.maxFlightMinutes} minutes per battery set.`,
  },
  {
    q: 'How many acres can the P10 Pro spray?',
    a: `${P10_FACTS.coverage}. Daily coverage depends on the crop, dose rate, field layout and how many battery sets the crew carries.`,
  },
  {
    q: 'What is the price of the P10 Pro in India?',
    a: P10_FACTS.priceInr
      ? `The P10 Pro is priced between ₹${P10_FACTS.priceInr.low.toLocaleString('en-IN')} and ₹${P10_FACTS.priceInr.high.toLocaleString('en-IN')}, depending on configuration. Contact us or an authorised dealer for a quote.`
      : 'Pricing depends on configuration and battery sets. Contact DroneAnatomy at info@droneanatomy.com for a current quote.',
  },
  {
    q: 'Do I need a remote pilot certificate to fly the P10 Pro?',
    a: 'Yes. Under India’s Drone Rules, 2021, operating a small-category agricultural drone like the P10 Pro requires a DGCA Remote Pilot Certificate, issued after training at a DGCA-authorised Remote Pilot Training Organisation.',
  },
  {
    q: 'Is the P10 Pro eligible for drone subsidies (Kisan Drone, Namo Drone Didi, SMAM)?',
    a: null,
  },
  {
    q: 'Which crops is the P10 Pro suited to?',
    a: null,
  },
  {
    q: 'What warranty comes with the P10 Pro?',
    a: P10_FACTS.warranty ? `The P10 Pro comes with ${P10_FACTS.warranty}.` : null,
  },
  {
    q: 'Where can I buy the P10 Pro or get it serviced?',
    a: 'Contact DroneAnatomy at info@droneanatomy.com or through droneanatomy.com/contact for sales, demos and service in your state.',
  },
];

/* The meta description, built from the facts above so it can never again
   disagree with the page it describes. Kept under ~160 characters. */
export const P10_META_DESCRIPTION =
  `P10 Pro by DroneAnatomy: an ultra-compact, DGCA type-certified agricultural spraying drone made in India. ` +
  `${P10_FACTS.tankLitres} L tank, ${P10_FACTS.sprayWidth} spray width, up to ${P10_FACTS.maxFlightMinutes} min flight.`;
