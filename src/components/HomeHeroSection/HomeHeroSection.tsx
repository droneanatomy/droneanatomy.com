'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CustomButton } from '../CustomButton';
import styles from './HomeHeroSection.module.css';

export interface HomeHeroSectionProps {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    heroImage?: string;
    heroImageAlt?: string;
    heroVideo?: string;
    /** Separate video to play on mobile (≤ 1024px). Falls back to heroImage if not provided. */
    heroVideoMobile?: string;
    fadeBottomColor?: string;
}

export const HomeHeroSection: React.FC<HomeHeroSectionProps> = ({
    title = 'Making Autonomous Flight Inevitable',
    subtitle = 'Drone Anatomy exists to build the fundamental systems that will define the next era of autonomous aviation',
    ctaText = 'Explore',
    ctaLink = '/about',
    heroImage = '/images/dronehero_mob.jpg',
    heroImageAlt = 'Drone Anatomy',
    heroVideo,
    heroVideoMobile,
    fadeBottomColor = 'transparent',
}) => {
    const particlesRef = useRef<HTMLDivElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mobileVideoRef = useRef<HTMLVideoElement>(null);
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Pause/resume desktop video based on viewport visibility
    useEffect(() => {
        const video = videoRef.current;
        if (!video || isMobile) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        video.play().catch(() => { });
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.1 }
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, [isMobile]);

    // Pause/resume mobile video based on viewport visibility
    useEffect(() => {
        const video = mobileVideoRef.current;
        if (!video || !isMobile || !heroVideoMobile) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        video.play().catch(() => { });
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.1 }
        );

        observer.observe(video);
        return () => observer.disconnect();
    }, [isMobile, heroVideoMobile]);

    useEffect(() => {
        const container = particlesRef.current;
        if (!container) return;

        for (let i = 0; i < 80; i++) {
            const d = document.createElement('div');
            d.className = styles.dot;
            d.style.left = (10 + Math.random() * 80) + '%';
            d.style.top = (20 + Math.random() * 60) + '%';
            d.style.animationDuration = (5 + Math.random() * 7) + 's';
            d.style.animationDelay = (-Math.random() * 10) + 's';
            const size = (1.5 + Math.random() * 2) + 'px';
            d.style.width = size;
            d.style.height = size;
            container.appendChild(d);
        }

        return () => { container.innerHTML = ''; };
    }, []);

    return (
        <section ref={sectionRef} className={styles.hero} style={{ '--fade-bottom': fadeBottomColor } as React.CSSProperties}>
            {/* ── Layer 1 (back): Full-screen video ── */}
            <div className={styles.videoLayer}>
                {isMobile !== null && (
                    heroVideo && !isMobile ? (
                        // Desktop video
                        <video
                            ref={videoRef}
                            className={styles.bgVideo}
                            src={heroVideo}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="auto"
                        />
                    ) : (isMobile && heroVideoMobile) ? (
                        // Mobile video
                        <video
                            ref={mobileVideoRef}
                            className={styles.bgVideo}
                            src={heroVideoMobile}
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="auto"
                        />
                    ) : isMobile ? (
                        // Mobile image fallback
                        <img
                            className={styles.bgVideo}
                            src={heroImage}
                            alt={heroImageAlt}
                        />
                    ) : null
                )}
                <div className={styles.videoOverlay} />
            </div>

            {/* ── Layer 2 (middle): Particle animations ── */}
            <div className={styles.animationLayer}>
                <div className={`${styles.glow} ${styles.glow1}`} />
                <div className={`${styles.glow} ${styles.glow2}`} />

                {/* <div className={styles.scanRings}>
                    <div className={styles.scanRing} />
                    <div className={styles.scanRing} />
                    <div className={styles.scanRing} />
                </div> */}

                <div className={styles.particles} ref={particlesRef} />
                <div className={styles.scanline} />
                <div className={styles.noise} />
            </div>

            {/* ── Layer 3 (front): Text content ── */}
            <div className={styles.contentLayer}>
                <div className={styles.textColumn}>
                    {title && <h1 className={styles.title}>{title}</h1>}
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    {ctaText && (
                        <div className={styles.ctaWrapper}>
                            <CustomButton href={ctaLink} showArrow>
                                {ctaText}
                            </CustomButton>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default HomeHeroSection;
