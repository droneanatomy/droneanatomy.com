'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './LatestNews.module.css';

export interface ContentItem {
    id: string;
    title: string;
    excerpt: string;
    image: string;
    date: string;
    category: string;
    slug: string;
    /** Optional external URL - if provided, links to external site instead of internal page */
    externalUrl?: string;
}

// Helper component for article links (handles both internal and external)
interface ArticleLinkProps {
    item: ContentItem;
    basePath: string;
    className: string;
    children: React.ReactNode;
}

const ArticleLink: React.FC<ArticleLinkProps> = ({ item, basePath, className, children }) => {
    if (item.externalUrl) {
        return (
            <a
                href={item.externalUrl}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        );
    }
    return (
        <Link href={`${basePath}/${item.slug}`} className={className}>
            {children}
        </Link>
    );
};

export interface ContentGridProps {
    /** Section title (e.g., "Latest News", "Our Blog") */
    title?: string;
    /** Section subtitle/description */
    subtitle?: string;
    /** Array of content items to display */
    items: ContentItem[];
    /** Base URL path for item links (e.g., "/updates", "/blog") */
    basePath?: string;
    /** Text for the expand button when collapsed */
    viewAllText?: string;
    /** Text for the expand button when expanded */
    showLessText?: string;
    /** Number of items to show in the initial grid (excluding featured) */
    initialGridCount?: number;
    /** Whether to show a featured (large) card for the first item */
    showFeatured?: boolean;
}

export const ContentGrid: React.FC<ContentGridProps> = ({
    title = 'Latest News',
    subtitle = 'Follow our journey as we continue to push the boundaries of drone technology',
    items,
    basePath = '/updates',
    viewAllText = 'View All',
    showLessText = 'Show Less',
    initialGridCount = 4,
    showFeatured = true,
}) => {
    const [showAll, setShowAll] = useState(false);

    if (!items || items.length === 0) {
        return null;
    }

    const featuredArticle = showFeatured ? items[0] : null;
    const gridStartIndex = showFeatured ? 1 : 0;
    const gridEndIndex = gridStartIndex + initialGridCount;

    const gridArticles = items.slice(gridStartIndex, gridEndIndex);
    const additionalArticles = items.slice(gridEndIndex);
    const hasMoreItems = additionalArticles.length > 0;

    return (
        <section className={styles.latestNews}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{title}</h2>
                    <p className={styles.subtitle}>{subtitle}</p>
                </div>

                <div className={styles.newsGrid}>
                    {/* Featured Article - Large Card */}
                    {featuredArticle && (
                        <ArticleLink item={featuredArticle} basePath={basePath} className={styles.featuredCard}>
                            <div className={styles.featuredImageWrapper}>
                                <Image
                                    src={featuredArticle.image}
                                    alt={featuredArticle.title}
                                    className={styles.featuredImage}
                                    fill
                                />
                                <div className={styles.featuredOverlay} />
                            </div>
                            <div className={styles.featuredContent}>
                                <span className={styles.category}>{featuredArticle.category}</span>
                                <h3 className={styles.featuredTitle}>{featuredArticle.title}</h3>
                                <p className={styles.featuredExcerpt}>{featuredArticle.excerpt}</p>
                                <div className={styles.meta}>
                                    <span className={styles.date}>{featuredArticle.date}</span>
                                    <span className={styles.readMore}>Read Article →</span>
                                </div>
                            </div>
                        </ArticleLink>
                    )}

                    {/* Grid Articles - Smaller Cards */}
                    <div className={styles.gridCards}>
                        {gridArticles.map((article) => (
                            <ArticleLink
                                key={article.id}
                                item={article}
                                basePath={basePath}
                                className={styles.gridCard}
                            >
                                <div className={styles.gridImageWrapper}>
                                    <Image
                                        src={article.image}
                                        alt={article.title}
                                        className={styles.gridImage}
                                        fill
                                    />
                                </div>
                                <div className={styles.gridContent}>
                                    <span className={styles.categorySmall}>{article.category}</span>
                                    <h4 className={styles.gridTitle}>{article.title}</h4>
                                    <span className={styles.dateSmall}>{article.date}</span>
                                </div>
                            </ArticleLink>
                        ))}
                    </div>
                </div>

                {/* Additional Items Row - Shows when expanded */}
                {showAll && additionalArticles.length > 0 && (
                    <div className={styles.additionalNews}>
                        {additionalArticles.map((article) => (
                            <ArticleLink
                                key={article.id}
                                item={article}
                                basePath={basePath}
                                className={styles.additionalCard}
                            >
                                <div className={styles.additionalImageWrapper}>
                                    <Image
                                        src={article.image}
                                        alt={article.title}
                                        className={styles.additionalImage}
                                        fill
                                    />
                                </div>
                                <div className={styles.additionalContent}>
                                    <span className={styles.categorySmall}>{article.category}</span>
                                    <h4 className={styles.additionalTitle}>{article.title}</h4>
                                    <p className={styles.additionalExcerpt}>{article.excerpt}</p>
                                    <span className={styles.dateSmall}>{article.date}</span>
                                </div>
                            </ArticleLink>
                        ))}
                    </div>
                )}

                {hasMoreItems && (
                    <div className={styles.viewAll}>
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className={styles.viewAllButton}
                        >
                            {showAll ? showLessText : viewAllText}
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                style={{ transform: showAll ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease' }}
                            >
                                {showAll ? (
                                    <polyline points="18 15 12 9 6 15" />
                                ) : (
                                    <>
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </>
                                )}
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
};

// Keep backward compatibility alias
export const LatestNews = ContentGrid;

export default ContentGrid;
