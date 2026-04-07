'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Counter.module.css';

export interface CounterProps {
    value: number;
    label: string;
    duration?: number;
    suffix?: string;
    prefix?: string;
}

export const Counter: React.FC<CounterProps> = ({
    value,
    label,
    duration = 2000,
    suffix = '',
    prefix = '',
}) => {
    const [count, setCount] = useState(0);
    const [hasAnimated, setHasAnimated] = useState(false);
    const counterRef = useRef<HTMLDivElement>(null);

    const animateValue = useCallback((start: number, end: number, animDuration: number) => {
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / animDuration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(start + (end - start) * easeOut);

            setCount(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !hasAnimated) {
                        setHasAnimated(true);
                        animateValue(0, value, duration);
                    }
                });
            },
            { threshold: 0.3 }
        );

        if (counterRef.current) {
            observer.observe(counterRef.current);
        }

        return () => observer.disconnect();
    }, [value, duration, hasAnimated, animateValue]);

    return (
        <div className={styles.counter} ref={counterRef}>
            <span className={styles.value}>
                {prefix}{count}{suffix}
            </span>
            <span className={styles.label}>{label}</span>
        </div>
    );
};

export default Counter;
