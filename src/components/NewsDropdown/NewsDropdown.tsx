'use client';

import React from 'react';
import Image from 'next/image';
import styles from './NewsDropdown.module.css';

interface NewsItem {
    id: string;
    title: string;
    date: string;
    image: string;
    href: string;
}

interface NewsDropdownProps {
    isOpen: boolean;
    items: NewsItem[];
    viewAllHref?: string;
    isMobile?: boolean;
}

export const NewsDropdown: React.FC<NewsDropdownProps> = ({
    isOpen,
    items,
    isMobile = false
}) => {
    return (
        <div className={`${styles.dropdownContainer} ${isOpen ? styles.open : ''} ${isMobile ? styles.mobile : ''}`}>
            <div className={styles.itemsContainer}>
                {items.slice(0, 4).map((item) => (
                    <a key={item.id} href={item.href} className={styles.newsItem} target='_blank' rel='noopener noreferrer'>
                        <Image src={item.image} alt={item.title} className={styles.thumbnail} width={80} height={60} />
                        <div className={styles.content}>
                            <span className={styles.itemTitle}>{item.title}</span>
                            <span className={styles.itemDate}>{item.date}</span>
                        </div>
                    </a>
                ))}
            </div>

            {/* <div className={styles.footer}>
                <a href={viewAllHref} className={styles.viewAll}>
                    All Updates
                </a>
            </div> */}
        </div>
    );
};

export default NewsDropdown;
