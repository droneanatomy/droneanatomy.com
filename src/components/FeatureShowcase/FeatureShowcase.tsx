'use client';

import React from 'react';
import Image from 'next/image';
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
                    <Image
                        src={mainImage}
                        alt=""
                        className={styles.mainImage}
                        loading="lazy"
                        width={600}
                        height={400}
                    />
                </div>
            </div>

            {/* Gallery Section */}
            {galleryImages.length > 0 && (
                <div className={styles.gallery}>
                    {galleryImages.map((image, index) => (
                        <div key={index} className={styles.galleryItem}>
                            <Image
                                src={image}
                                alt=""
                                className={styles.galleryImage}
                                loading="lazy"
                                width={400}
                                height={300}
                            />
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default FeatureShowcase;
