/* ============================================================
   llms.txt and llms-full.txt — the site in plain Markdown, for AI tools.

   llms.txt (https://llmstxt.org) is a short map: who we are, then a
   linked list of the pages worth reading. llms-full.txt is the same with
   the substance inlined — the P10 Pro spec sheet and FAQ in full — so an
   assistant can answer from one fetch without parsing a scroll film.

   GENERATED, NOT HAND-WRITTEN. Every P10 Pro number comes from spec.ts,
   the same source as the page, its meta and its JSON-LD; a static .txt in
   /public would have been one more copy to drift. The other aircraft are
   described only with claims their own pages already make.
   ============================================================ */

import { SITE_URL, SITE_NAME } from './site';
import { P10_FACTS, P10_SPEC, P10_FAQ, SIZE_CLAIM } from './products/p10-pro/spec';

const SUMMARY =
  `${SITE_NAME} designs and manufactures autonomous drones in India, with the airframe, ` +
  `flight controller, sensors and autonomy stack developed in-house. Its main product is the ` +
  `P10 Pro, an ultra-compact, DGCA type-certified agricultural spraying drone built for Indian farms.`;

const PRODUCTS = [
  {
    name: 'P10 Pro',
    path: '/products/p10-pro',
    desc: `Agricultural spraying drone. ${P10_FACTS.tankLitres} L tank, ${P10_FACTS.sprayWidth} spray width, up to ${P10_FACTS.maxFlightMinutes} minutes of flight, DGCA type certified.`,
  },
  {
    name: 'Cyclops',
    path: '/products/cyclops',
    desc: 'VTOL fixed-wing endurance aircraft: six hours aloft, 150 km range, 10 kg payload, no runway or launcher.',
  },
  {
    name: 'NOXR-1',
    path: '/products/noxr-1',
    desc: 'Multirole observation platform: day/night EO/IR with laser rangefinder, frequency hopping, sixty minutes on station.',
  },
  {
    name: 'Mini',
    path: '/products/mini',
    desc: 'Compact airframe that folds into a case carried by the crew, running the same stack as the rest of the fleet.',
  },
];

const PAGES = [
  { name: 'About', path: '/about', desc: 'Company mission, vision and team' },
  { name: 'Updates', path: '/updates', desc: 'Press coverage and company news' },
  { name: 'Contact', path: '/contact', desc: 'Sales, demos, support and partnerships — info@droneanatomy.com' },
  { name: 'Careers', path: '/careers', desc: 'Open roles' },
];

const link = (name: string, path: string, desc: string) =>
  `- [${name}](${SITE_URL}${path}): ${desc}`;

export function llmsTxt(): string {
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SUMMARY}`,
    '',
    `Brand name: "${SITE_NAME}" (one word; also written "Drone Anatomy"). Based in Delhi, India. Contact: info@droneanatomy.com.`,
    '',
    '## Products',
    '',
    ...PRODUCTS.map((p) => link(p.name, p.path, p.desc)),
    '',
    '## Company',
    '',
    ...PAGES.map((p) => link(p.name, p.path, p.desc)),
    '',
    '## Optional',
    '',
    link('Full text', '/llms-full.txt', 'P10 Pro specifications and FAQ in full'),
    '',
  ].join('\n');
}

export function llmsFullTxt(): string {
  const spec = P10_SPEC.flatMap((g) => {
    const rows = g.rows.filter((r) => r.value);
    if (!rows.length) return [];
    return [`### ${g.heading}`, '', '| Specification | Value |', '| --- | --- |',
      ...rows.map((r) => `| ${r.label} | ${r.value} |`), ''];
  });
  const faq = P10_FAQ.filter((f) => f.a).flatMap((f) => [`### ${f.q}`, '', f.a as string, '']);

  return [
    llmsTxt(),
    '---',
    '',
    `## ${P10_FACTS.name} — official specifications`,
    '',
    `Source: ${SITE_URL}/products/p10-pro. These figures are the manufacturer's official values and supersede any differing figures on dealer listings.`,
    '',
    ...spec,
    `Note: "40% smaller" means ${SIZE_CLAIM.charAt(0).toLowerCase()}${SIZE_CLAIM.slice(1)} Flight time is the maximum and falls with payload, wind and temperature.`,
    '',
    `## ${P10_FACTS.name} — frequently asked questions`,
    '',
    ...faq,
  ].join('\n');
}
