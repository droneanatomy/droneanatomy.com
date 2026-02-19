'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import styles from './Slider.module.css';

export interface SpecItem {
    label: string;
    value: string;
}

export interface SlideItem {
    title: string;
    description: string;
    backgroundImage?: string;
    backgroundVideo?: string;
    sideImage?: string;
    sideVideo?: string;
    specs?: SpecItem[];
}

export interface SliderProps {
    slides: SlideItem[];
    className?: string;
}

export const Slider: React.FC<SliderProps> = ({
    slides,
    className = '',
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isInView, setIsInView] = useState(false);
    const sliderRef = useRef<HTMLElement>(null);
    const bgVideoRef = useRef<HTMLVideoElement>(null);
    const sideVideoRef = useRef<HTMLVideoElement>(null);

    // IntersectionObserver to detect when slider is in view
    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    setIsInView(entry.isIntersecting);
                });
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        observer.observe(slider);
        return () => observer.disconnect();
    }, []);

    // Play/pause videos based on visibility
    useEffect(() => {
        const bgVideo = bgVideoRef.current;
        const sideVideo = sideVideoRef.current;

        if (isInView) {
            bgVideo?.play().catch(() => { });
            sideVideo?.play().catch(() => { });
        } else {
            bgVideo?.pause();
            sideVideo?.pause();
        }
    }, [isInView, currentIndex]);

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    }, [slides.length]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, [slides.length]);

    const goToSlide = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    if (!slides.length) return null;

    const currentSlide = slides[currentIndex];
    const hasBackground = currentSlide.backgroundImage || currentSlide.backgroundVideo;
    const hasSideMedia = currentSlide.sideImage || currentSlide.sideVideo;

    return (
        <section ref={sliderRef} className={`${styles.slider} ${hasSideMedia ? styles.sliderWithSide : ''} ${className}`}>
            {/* Background */}
            <div className={styles.backgroundContainer}>
                {currentSlide.backgroundVideo ? (
                    <video
                        ref={bgVideoRef}
                        className={styles.backgroundVideo}
                        src={isInView ? currentSlide.backgroundVideo : undefined}
                        muted
                        playsInline
                        preload="none"
                    />
                ) : currentSlide.backgroundImage ? (
                    <img
                        src={currentSlide.backgroundImage}
                        alt=""
                        className={styles.backgroundImage}
                    />
                ) : null}
                {hasBackground && <div className={styles.overlay} />}
            </div>

            {/* Content */}
            <div className={styles.contentContainer}>
                <div className={styles.content}>
                    {/* Mobile: Title with arrows */}
                    <div className={styles.mobileHeader}>
                        <h2 className={styles.title}>{currentSlide.title}</h2>
                        <div className={styles.mobileArrows}>
                            <button
                                type="button"
                                className={styles.arrowButton}
                                onClick={goToPrevious}
                                aria-label="Previous slide"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                className={styles.arrowButton}
                                onClick={goToNext}
                                aria-label="Next slide"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Desktop: Title only */}
                    <h2 className={styles.desktopTitle}>{currentSlide.title}</h2>

                    <p className={styles.description}>{currentSlide.description}</p>

                    {/* Specs Table */}
                    {currentSlide.specs && currentSlide.specs.length > 0 && (
                        <div className={styles.specsTable}>
                            {currentSlide.specs.map((spec, index) => (
                                <div key={index} className={styles.specRow}>
                                    <span className={styles.specLabel}>{spec.label}</span>
                                    <span className={styles.specValue}>{spec.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Side Image/Video */}
                {hasSideMedia && (
                    <div className={styles.sideMedia}>
                        {currentSlide.sideVideo ? (
                            <video
                                ref={sideVideoRef}
                                className={styles.sideVideo}
                                src={isInView ? currentSlide.sideVideo : undefined}
                                muted
                                playsInline
                                preload="none"
                            />
                        ) : currentSlide.sideImage ? (
                            <img
                                src={currentSlide.sideImage}
                                alt=""
                                className={styles.sideImage}
                            />
                        ) : null}
                    </div>
                )}
            </div>

            {/* Desktop Navigation Arrows */}
            {/* <button
                type="button"
                className={`${styles.navArrow} ${styles.navArrowLeft}`}
                onClick={goToPrevious}
                aria-label="Previous slide"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
            </button>
            <button
                type="button"
                className={`${styles.navArrow} ${styles.navArrowRight}`}
                onClick={goToNext}
                aria-label="Next slide"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
            </button> */}

            {/* Dot Indicators */}
            {/* <div className={styles.dots}>
                {slides.map((_, index) => (
                    <button
                        key={index}
                        type="button"
                        className={`${styles.dot} ${index === currentIndex ? styles.dotActive : ''}`}
                        onClick={() => goToSlide(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div> */}
        </section>
    );
};

export default Slider;
