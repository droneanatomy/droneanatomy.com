/* ============================================================
   P10Facts — the P10 Pro's spec table, FAQ and structured data.

   SERVER COMPONENT, deliberately: no 'use client', no animation, no
   WebGL. Everything above it on the page is a scroll film that a crawler
   and an AI assistant cannot watch. This is the part they CAN read, so it
   has to be plain HTML in out/products/p10-pro.html at build time — a
   <table> and a list of <details>, not a canvas or an image of a table.

   Every value comes from spec.ts. Nothing here states a number.
   ============================================================ */

import { SITE_NAME } from '@/app/site';
import { P10_FACTS, P10_SPEC, P10_FAQ, SIZE_CLAIM } from './spec';
import styles from './P10Facts.module.css';

/* JSON inside a <script> ends at the first "</script>", whatever JSON
   thinks — escaping '<' is the standard guard. */
function jsonLd(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}

export function P10Facts() {
  const groups = P10_SPEC
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.value) }))
    .filter((g) => g.rows.length);
  const faqs = P10_FAQ.filter((f) => f.a);

  /* The Product schema lives in page.tsx; this component owns only the
     FAQ markup, next to the questions it describes. */
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <section className={styles.root} aria-labelledby="p10-spec-heading">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqPage)} />

      <div className={styles.inner}>
        <p className={styles.eyebrow}>Specifications</p>
        <h2 id="p10-spec-heading" className={styles.heading}>
          {P10_FACTS.name} technical specifications
        </h2>
        <p className={styles.lede}>
          The {SITE_NAME} {P10_FACTS.name} is an ultra-compact agricultural spraying drone,
          designed and built in India for small and hilly farms. It carries a{' '}
          {P10_FACTS.tankLitres} L tank across a {P10_FACTS.sprayWidth} swath, flies for up
          to {P10_FACTS.maxFlightMinutes} minutes, and is {SIZE_CLAIM.replace(/\.$/, '')}.
        </p>

        <table className={styles.table}>
          <caption className={styles.srOnly}>{P10_FACTS.name} specifications</caption>
          {groups.map((g) => (
            <tbody key={g.heading}>
              <tr>
                <th colSpan={2} scope="colgroup" className={styles.group}>
                  {g.heading}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <p className={styles.note}>
          * “40% smaller”: {SIZE_CLAIM} Flight time is the maximum and falls with payload,
          wind and temperature.
        </p>

        <h2 className={styles.heading}>Frequently asked questions</h2>
        <div className={styles.faq}>
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
