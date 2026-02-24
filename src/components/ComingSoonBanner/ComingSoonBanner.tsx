'use client';

import React, { useRef, useEffect, useState } from 'react';
import styles from './ComingSoonBanner.module.css';

export interface FeatureHighlight {
    icon: React.ReactNode;
    title: string;
    description: string;
}

export interface ComingSoonBannerProps {
    title?: string;
    subtitle?: string;
    backgroundImage?: string;
    backgroundImageMobile?: string;
    backgroundVideo?: string;
    features?: FeatureHighlight[];
    className?: string;
}

const defaultIcons = {
    precision: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.73-3.558" />
        </svg>
    ),
    shield: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
    ),
    bolt: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
    ),
    clock: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
};

const defaultFeatures: FeatureHighlight[] = [
    {
        icon: defaultIcons.precision,
        title: 'Precision Engineering',
        description: 'Built with exacting standards for reliable autonomous flight.',
    },
    {
        icon: defaultIcons.shield,
        title: 'Mission-Grade Reliability',
        description: 'Designed from failure prevention to trusted performance.',
    },
    {
        icon: defaultIcons.bolt,
        title: 'High Performance',
        description: 'Optimized propulsion and payload systems for demanding ops.',
    },
    {
        icon: defaultIcons.clock,
        title: 'Extended Endurance',
        description: 'Longer flight times with intelligent power management.',
    },
];

export const ComingSoonBanner: React.FC<ComingSoonBannerProps> = ({
    title = 'Coming Soon',
    subtitle,
    backgroundImage,
    backgroundImageMobile,
    backgroundVideo,
    features = defaultFeatures,
    className = '',
}) => {
    const sectionRef = useRef<HTMLElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isInView, setIsInView] = useState(false);
    // Once true, never goes back to false — prevents src toggling which causes flicker
    const hasBeenInView = useRef(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Lazy load and play/pause video based on viewport visibility
    useEffect(() => {
        const section = sectionRef.current;
        if (!section || !backgroundVideo) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        hasBeenInView.current = true;
                    }
                    setIsInView(entry.isIntersecting);
                });
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        observer.observe(section);
        return () => observer.disconnect();
    }, [backgroundVideo]);

    // Play/pause video based on visibility
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (isInView) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isInView]);

    return (
        <section ref={sectionRef} className={`${styles.banner} ${className}`}>
            {/* Background */}
            <div className={styles.backgroundContainer}>
                {backgroundVideo ? (
                    <video
                        ref={videoRef}
                        className={styles.backgroundVideo}
                        src={hasBeenInView.current ? backgroundVideo : undefined}
                        muted
                        loop
                        playsInline
                        preload="none"
                    />
                ) : (isMobile && backgroundImageMobile) ? (
                    <img
                        className={styles.backgroundImage}
                        src={backgroundImageMobile}
                        alt=""
                        loading="lazy"
                    />
                ) : backgroundImage ? (
                    <img
                        className={styles.backgroundImage}
                        src={backgroundImage}
                        alt=""
                        loading="lazy"
                    />
                ) : null}
            </div>

            {/* Overlay */}
            <div className={styles.overlay} />

            {/* Center content */}
            <div className={styles.centerContent}>
                <h1 className={styles.title}>{title}</h1>
                {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>

            {/* Feature strip pinned to bottom */}
            {features.length > 0 && (
                <div className={styles.featureStrip}>
                    <div className={styles.featureGrid}>
                        {features.map((feature, index) => (
                            <div key={index} className={styles.featureItem}>
                                <div className={styles.featureIcon}>
                                    {feature.icon}
                                </div>
                                <h4 className={styles.featureTitle}>
                                    {feature.title}
                                </h4>
                                <p className={styles.featureDescription}>
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

export default ComingSoonBanner;
