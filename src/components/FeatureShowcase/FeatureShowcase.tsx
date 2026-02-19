'use client';

import React from 'react';
import { CTAButton } from '../CTAButton';
import styles from './FeatureShowcase.module.css';
import { CustomButton } from '../CustomButton';

export interface FeatureShowcaseProps {
    title: string;
    features: string[];
    ctaText?: string;
    ctaLink?: string;
    mainImage: string;
    galleryImages: string[];
    className?: string;
}

export const FeatureShowcase: React.FC<FeatureShowcaseProps> = ({
    title,
    features,
    ctaText,
    ctaLink = '/contact',
    mainImage,
    galleryImages,
    className = '',
}) => {
    const handleScrollToFooter = () => {
        const footer = document.querySelector('footer');
        if (footer) {
            footer.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section className={`${styles.showcase} ${className}`}>
            {/* Hero Section */}
            <div className={styles.heroSection}>
                <div className={styles.content}>
                    <h2 className={styles.title}>{title}</h2>
                    <ul className={styles.featureList}>
                        {features.map((feature, index) => (
                            <li key={index} className={styles.featureItem}>
                                <svg
                                    className={styles.checkIcon}
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                    {ctaText && (
                        <CustomButton
                            href={ctaLink}
                            className={styles.ctaButton}
                        >
                            {ctaText}
                        </CustomButton>
                    )}
                </div>
                <div className={styles.mainImageContainer}>
                    <img
                        src={mainImage}
                        alt=""
                        className={styles.mainImage}
                        loading="lazy"
                    />
                </div>
            </div>

            {/* Gallery Section */}
            {galleryImages.length > 0 && (
                <div className={styles.gallery}>
                    {galleryImages.map((image, index) => (
                        <div key={index} className={styles.galleryItem}>
                            <img
                                src={image}
                                alt=""
                                className={styles.galleryImage}
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default FeatureShowcase;
