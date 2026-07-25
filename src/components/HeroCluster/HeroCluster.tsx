'use client';

/* ============================================================
   HeroCluster — Lusion-style hero shell.

   A light section holding a dark rounded card. The card's visual is
   ThermalTerrain: a 2.5D aerial site that parallaxes with the cursor
   and reveals a thermal-imaging lens under the pointer. Chrome (word-
   mark, tagline, nav, scroll cue, corner ticks) is laid over the top.

   Mounted lazily (ssr:false) via LazyHeroCluster so WebGL never SSRs
   and stays off the server bundle.
   ============================================================ */

import React from 'react';
import { ThermalTerrain } from './ThermalTerrain';
import styles from './HeroCluster.module.css';

export interface HeroClusterProps {
  className?: string;
  wordmark?: string;
  tagline?: string;
  /* Optional real assets; procedural site is used when omitted. */
  imageSrc?: string;
  thermalSrc?: string;
  depthSrc?: string;
}

export const HeroCluster: React.FC<HeroClusterProps> = ({
  className = '',
  wordmark = 'DroneAnatomy',
  tagline = 'We build the autonomous systems that define the next era of flight.',
  imageSrc,
  thermalSrc,
  depthSrc,
}) => {
  return (
    <section className={`${styles.hero} ${className}`}>
      {/* Top chrome */}
      <div className={styles.top}>
        <a href="/" className={styles.mark}>
          {wordmark}
        </a>
        <p className={styles.tagline}>{tagline}</p>
        <nav className={styles.nav} aria-label="Primary">
          <button className={styles.pillIcon} aria-label="Collapse">
            <span />
          </button>
          <a href="/contact" className={styles.pillDark}>
            Let&rsquo;s talk <i />
          </a>
          <button className={styles.pill}>Menu &middot;&middot;</button>
        </nav>
      </div>

      {/* 3D card */}
      <div className={styles.card}>
        <ThermalTerrain imageSrc={imageSrc} thermalSrc={thermalSrc} depthSrc={depthSrc} />
        <span className={`${styles.tick} ${styles.tl}`}>+</span>
        <span className={`${styles.tick} ${styles.tr}`}>+</span>
        <span className={`${styles.tick} ${styles.bl}`}>+</span>
        <span className={`${styles.tick} ${styles.br}`}>+</span>
        <span className={styles.hint}>Hover to scan &middot; thermal imaging</span>
      </div>

      {/* Bottom rail */}
      <div className={styles.rail}>
        <span className={styles.plus}>+</span>
        <span className={styles.scroll}>Scroll to explore</span>
        <span className={styles.plus}>+</span>
      </div>
    </section>
  );
};

export default HeroCluster;
