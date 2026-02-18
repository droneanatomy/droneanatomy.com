'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dropdown } from '../Dropdown';
import { CTAButton } from '../CTAButton';
import { NewsDropdown } from '../NewsDropdown';
import styles from './Header.module.css';

const productItems = [
    { label: 'P10 Pro', href: '/products/p10-pro' },
    { label: 'NOXR-1', href: '/products/noxr-1' },
    { label: 'Cyclops 3', href: '/products/cyclops-3' },
    { label: 'Cyclops Mini', href: '/products/cyclops-mini' },
    { label: 'LiftX100', href: '/products/liftx100' },
];

// const companyItems = [
//     { label: 'Mission', href: '/about' },
//     { label: 'Updates', href: '/updates' },
//     { label: 'Careers', href: '/careers' },
// ];

const navItems = [
    { label: 'Mission', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Updates', href: '/updates' },
    { label: 'Contact', href: '/contact' },

];

const upcomingUpdates = [
    {
        id: '1',
        title: 'NOXR-1',
        image: '/images/NOXR-COMING-SOON.png',
        date: 'Coming Soon',
        href: '/products/noxr-1',
    },
    {
        id: '2',
        title: 'Cyclops 3',
        image: '/images/CYCLOPS3.png',
        date: 'Coming Soon',
        href: '/products/cyclops-3',
    },
    {
        id: '3',
        title: 'Cyclops Mini',
        image: '/images/CYCLOPS.png',
        date: 'Coming Soon',
        href: '/products/cyclops-mini',
    },
    {
        id: '4',
        title: 'LiftX100',
        image: '/images/LIFTX100.png',
        date: 'Coming Soon',
        href: '/products/liftx100',
    },
];

export const Header: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUpdatesOpen, setIsUpdatesOpen] = useState(false);
    const lastScrollY = useRef(0);

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const currentScrollY = window.scrollY;
                    const isDesktop = window.innerWidth > 1024;

                    setIsScrolled(currentScrollY > 50);

                    // Only apply hide/show on desktop
                    if (isDesktop && currentScrollY > 100) {
                        setIsHidden(currentScrollY > lastScrollY.current);
                    } else {
                        setIsHidden(false);
                    }

                    lastScrollY.current = currentScrollY;
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileMenuOpen]);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <>
            <header
                className={`${styles.header} ${isScrolled ? styles.scrolled : ''} ${isHidden ? styles.hidden : ''}`}
            >
                {/* Logo */}
                <a href="/" className={styles.logo}>
                    <img src="/images/logo.png" alt="DroneAnatomy" className={styles.logoImage} />
                </a>

                {/* Desktop Navigation */}
                <nav className={styles.nav}>
                    <ul className={styles.navList}>
                        <li>
                            <Dropdown label="Systems" items={productItems} />
                        </li>
                        {/* <li>
                            <Dropdown label="Company" items={companyItems} />
                        </li> */}
                        {navItems.map((item) => (
                            <li key={item.label}>
                                <a href={item.href} className={styles.navLink}>
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Desktop CTA */}
                <div
                    className={styles.ctaContainer}
                    onMouseEnter={() => setIsUpdatesOpen(true)}
                    onMouseLeave={() => setIsUpdatesOpen(false)}
                >
                    <CTAButton href="/updates">
                        Upcoming Launches
                    </CTAButton>
                    <NewsDropdown isOpen={isUpdatesOpen} items={upcomingUpdates} />
                </div>

                {/* Mobile Menu Button */}
                <button
                    type="button"
                    className={`${styles.mobileMenuBtn} ${isMobileMenuOpen ? styles.open : ''}`}
                    onClick={toggleMobileMenu}
                    aria-label="Toggle menu"
                    aria-expanded={isMobileMenuOpen}
                >
                    <span className={styles.hamburger} />
                </button>
            </header>

            {/* Mobile Menu Overlay */}
            <div
                className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.open : ''}`}
            >
                {/* Mobile Menu Header */}
                <div className={styles.mobileMenuHeader}>
                    <a href="/" className={styles.mobileMenuLogo} onClick={closeMobileMenu}>
                        <img src="/images/logo.png" alt="DroneAnatomy" className={styles.logoImage} />
                    </a>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={closeMobileMenu}
                        aria-label="Close menu"
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <nav>
                    <ul className={styles.mobileNavList}>
                        <li>
                            <Dropdown label="Systems" items={productItems} />
                        </li>
                        {/* <li>
                            <Dropdown label="Company" items={companyItems} />
                        </li> */}
                        {navItems.map((item) => (
                            <li key={item.label}>
                                <a
                                    href={item.href}
                                    className={styles.mobileNavLink}
                                    onClick={closeMobileMenu}
                                >
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <div className={styles.mobileCta}>
                        <CTAButton
                            showArrow
                            size='small'
                            href='/updates'
                        >
                            Upcoming Updates
                        </CTAButton>
                        <NewsDropdown
                            isOpen={true}
                            items={upcomingUpdates}
                            isMobile={true}
                        />
                    </div>
                </nav>
            </div>
        </>
    );
};

export default Header;
