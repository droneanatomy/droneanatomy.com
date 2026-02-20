'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './Dropdown.module.css';

export interface DropdownItem {
    label: string;
    href?: string;
    onClick?: () => void;
}

export interface DropdownProps {
    label: string;
    items: DropdownItem[];
    className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
    label,
    items,
    className = '',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 150);
    };

    const handleClick = () => {
        setIsOpen(!isOpen);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`${styles.dropdownContainer} ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                type="button"
                className={styles.trigger}
                onClick={handleClick}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {label}
                <span className={`${styles.triggerIcon} ${isOpen ? styles.open : ''}`}>
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-text-primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </span>
            </button>

            <div
                className={`${styles.menu} ${isOpen ? styles.open : ''}`}
                role="menu"
            >
                {items.map((item, index) => (
                    <a
                        key={index}
                        href={item.href || '#'}
                        className={styles.menuItem}
                        role="menuitem"
                        onClick={(e) => {
                            if (item.onClick) {
                                e.preventDefault();
                                item.onClick();
                            }
                            setIsOpen(false);
                        }}
                    >
                        {item.label}
                    </a>
                ))}
            </div>
        </div>
    );
};

export default Dropdown;
