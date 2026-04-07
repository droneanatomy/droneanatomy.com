'use client';

import React from 'react';
import Image from 'next/image';
import styles from './Card.module.css';

export interface CardProps {
    image?: string;
    preTitle?: string;
    title: string;
    description?: string;
    className?: string;
}

export const Card: React.FC<CardProps> = ({
    image,
    preTitle,
    title,
    description,
    className = '',
}) => {
    return (
        <article className={`${styles.card} ${className}`}>
            {image && (
                <div className={styles.imageWrapper}>
                    <Image
                        src={image}
                        alt={title}
                        className={styles.image}
                        loading="lazy"
                        fill
                        priority
                    />
                </div>
            )}
            <div className={styles.content}>
                {preTitle && <span className={styles.preTitle}>{preTitle}</span>}
                <h3 className={styles.title}>{title}</h3>
                {description && <p className={styles.description}>{description}</p>}
            </div>
        </article>
    );
};

export default Card;
