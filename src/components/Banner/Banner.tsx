'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CustomButton } from '../CustomButton';

import styles from './Banner.module.css';

export type ContentPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center-left'
    | 'center'
    | 'center-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

export interface BannerProps {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    backgroundImage?: string;
    backgroundImageMobile?: string;
    backgroundVideo?: string;
    contentPosition?: ContentPosition;
    overlayStyle?: 'dark' | 'light' | 'none';
    showScrollIndicator?: boolean;
    showEmailSignup?: boolean;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    titleSize?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
    animate?: boolean;
    className?: string;
    textColor?: 'black' | 'white';
    subtitleSize?: 'sm' | 'md' | 'lg' | 'xl';
    useParticleBackground?: boolean;
    fadeTopColor?: string;
    fadeBottomColor?: string;
}

const subtitleSizeClassMap: Record<string, string> = {
    'sm': styles.subtitleSm,
    'md': styles.subtitleMd,
    'lg': styles.subtitleLg,
    'xl': styles.subtitleXl,
};

const titleSizeClassMap: Record<string, string> = {
    'sm': styles.titleSm,
    'md': styles.titleMd,
    'lg': styles.titleLg,
    'xl': styles.titleXl,
    'hero': styles.titleHero,
};

const positionClassMap: Record<ContentPosition, string> = {
    'top-left': styles.topLeft,
    'top-center': styles.topCenter,
    'top-right': styles.topRight,
    'center-left': styles.centerLeft,
    'center': styles.center,
    'center-right': styles.centerRight,
    'bottom-left': styles.bottomLeft,
    'bottom-center': styles.bottomCenter,
    'bottom-right': styles.bottomRight,
};

export const Banner: React.FC<BannerProps> = ({
    title,
    subtitle,
    ctaText,
    ctaLink,
    backgroundImage,
    backgroundImageMobile,
    backgroundVideo,
    contentPosition = 'bottom-left',
    overlayStyle = 'dark',
    showScrollIndicator = false,
    showEmailSignup = false,
    textAlign,
    titleSize,
    animate = false,
    className = '',
    textColor,
    subtitleSize,
    useParticleBackground = false,
    fadeTopColor = 'transparent',
    fadeBottomColor = 'transparent',
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const particlesRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isInView, setIsInView] = useState(false);
    // Once true, never goes back to false — prevents src toggling which causes flicker
    const hasBeenInView = useRef(false);
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    // Check if mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Observe section visibility for lazy video loading
    useEffect(() => {
        const section = sectionRef.current;
        if (!section || isMobile || !backgroundVideo) return;

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
    }, [isMobile, backgroundVideo]);

    // Play/pause video based on visibility
    useEffect(() => {
        const video = videoRef.current;
        if (!video || isMobile) return;

        if (isInView) {
            video.play().catch(() => {
                // Autoplay was prevented
            });
        } else {
            video.pause();
        }
    }, [isInView, isMobile]);

    // Generate particle dots
    useEffect(() => {
        const container = particlesRef.current;
        if (!container || !useParticleBackground) return;
        for (let i = 0; i < 25; i++) {
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
    }, [useParticleBackground]);

    const handleScrollClick = () => {
        window.scrollBy({
            top: window.innerHeight,
            behavior: 'smooth',
        });
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsSubmitting(true);
        setMessage('');

        const endpoint = process.env.NEXT_PUBLIC_NEWSLETTER_ENDPOINT;

        if (!endpoint) {
            setMessage('Newsletter service is not configured.');
            setIsSubmitting(false);
            return;
        }

        const body = new URLSearchParams();
        body.append('email', email);
        body.append('userGroup', 'Newsletter');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: body,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            });

            if (response.ok) {
                setSubmitted(true);
                setEmail('');
                setMessage('Successfully subscribed!');
                setTimeout(() => setSubmitted(false), 3000);
            } else {
                const errorText = await response.text();
                console.error('Newsletter subscription failed:', response.status, errorText || response.statusText);
                setMessage('Failed to subscribe. Please try again.');
            }
        } catch (error) {
            console.error('Newsletter subscription error:', error);
            setMessage('An error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const positionClass = positionClassMap[contentPosition];

    return (
        <section
            ref={sectionRef}
            className={`${styles.banner} ${useParticleBackground ? styles.particleBg : ''} ${className}`}
            style={{ '--fade-top': fadeTopColor, '--fade-bottom': fadeBottomColor } as React.CSSProperties}
        >
            {/* Background */}
            <div className={styles.backgroundContainer}>
                {useParticleBackground ? (
                    <>
                        <div className={`${styles.glow} ${styles.glow1}`} />
                        <div className={`${styles.glow} ${styles.glow2}`} />
                        <div className={styles.scanRings}>
                            <div className={styles.scanRing} />
                            <div className={styles.scanRing} />
                            <div className={styles.scanRing} />
                        </div>
                        <div className={styles.particles} ref={particlesRef} />
                        <div className={styles.scanline} />
                        <div className={styles.noise} />
                    </>
                ) : (
                    <>
                        {/* Show video only on desktop if provided */}
                        {backgroundVideo && !isMobile ? (
                            <video
                                ref={videoRef}
                                className={styles.backgroundVideo}
                                src={hasBeenInView.current ? backgroundVideo : undefined}
                                muted
                                loop
                                playsInline
                                preload="none"
                                poster={backgroundImage}
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
                    </>
                )}
            </div>

            {/* Overlay */}
            {overlayStyle !== 'none' && (
                <div
                    className={`${styles.overlay} ${overlayStyle === 'dark' ? styles.overlayDark : styles.overlayLight
                        }`}
                />
            )}

            {/* Content Grid */}
            <div className={styles.contentGrid}>
                <div
                    className={`${styles.content} ${positionClass} ${textAlign === 'center' ? styles.mobileCenter : ''}`}
                    style={textAlign ? {
                        textAlign,
                        alignItems: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start'
                    } : undefined}
                >
                    {title && (
                        <h2 className={`${styles.title} ${titleSize ? titleSizeClassMap[titleSize] : ''} ${animate ? styles.animateSlideUp : ''} ${textColor ? styles[`text${textColor.charAt(0).toUpperCase() + textColor.slice(1)}`] : ''}`}>
                            {title}
                        </h2>
                    )}
                    {subtitle && (
                        <p className={`${styles.subtitle} ${subtitleSize ? subtitleSizeClassMap[subtitleSize] : ''} ${animate ? styles.animateSlideUpDelay : ''} ${textColor ? styles[`text${textColor.charAt(0).toUpperCase() + textColor.slice(1)}`] : ''}`}>
                            {subtitle}
                        </p>
                    )}
                    {showEmailSignup && (
                        <form className={styles.emailForm} onSubmit={handleEmailSubmit}>
                            <input
                                type="email"
                                className={styles.emailInput}
                                placeholder="Your email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <button type="submit" className={styles.emailSubmit} disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : submitted ? 'Thank you!' : 'Submit'}
                            </button>
                            {message && <p className={styles.message} style={{ color: submitted ? 'lightgreen' : '#ff6b6b' }}>{message}</p>}
                        </form>
                    )}
                    <div className={styles.ctaWrapper}>
                        <div style={{ visibility: ctaText ? 'visible' : 'hidden', pointerEvents: ctaText ? 'auto' : 'none' }}>
                            <CustomButton href={ctaLink || '#'} showArrow>
                                {ctaText || 'Placeholder'}
                            </CustomButton>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scroll Indicator */}
            {showScrollIndicator && (
                <button
                    type="button"
                    className={styles.scrollIndicator}
                    onClick={handleScrollClick}
                    aria-label="Scroll down"
                >
                    <span className={styles.scrollText}>Scroll</span>
                    <span className={styles.scrollArrow}>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </span>
                </button>
            )}
        </section>
    );
};

export default Banner;
