'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './contact.module.css';


export default function ContactPage() {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setStatus('submitting');

        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            const response = await fetch('https://formspree.io/f/xdalkdko', {
                method: 'POST',
                body: formData,
                headers: {
                    Accept: 'application/json',
                },
            });

            if (response.ok) {
                setStatus('success');
                setMessage('Thank you! Your message has been sent successfully.');
                form.reset();
                // Auto-hide success message after 5 seconds
                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                }, 5000);
            } else {
                setStatus('error');
                setMessage('Oops! Something went wrong. Please try again.');
            }
        } catch {
            setStatus('error');
            setMessage('Oops! Something went wrong. Please try again.');
        }
    };

    return (
        <section className={styles.contactHero}>
            {/* Background Image */}
            <div className={styles.backgroundContainer}>
                <Image
                    src="/images/careers-hero.jpg"
                    alt=""
                    className={styles.backgroundImage}
                    fill
                    priority
                />
                <div className={styles.overlay} />
            </div>


            <div className={styles.content}>
                <div className={styles.headerSection}>
                    <h1 className={styles.title}>Get In Touch</h1>
                    <p className={styles.subtitle}>
                        Have questions about our drones or need support? We&apos;re here to help.
                        Reach out through any of our channels below.
                    </p>
                </div>

                <div className={styles.mainGrid}>
                    {/* Contact Form */}
                    <div className={styles.formSection}>
                        <h2 className={styles.sectionTitle}>Send a Message</h2>
                        <form onSubmit={handleSubmit} className={styles.contactForm}>
                            <div className={styles.formRow}>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="name" className={styles.label}>Name</label>
                                    <input
                                        type="text"
                                        id="name"
                                        name="name"
                                        className={styles.input}
                                        placeholder="Your full name"
                                        required
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="email" className={styles.label}>Email</label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        className={styles.input}
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label htmlFor="phone" className={styles.label}>Phone (Optional)</label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    className={styles.input}
                                    placeholder="+91 XXXXX XXXXX"
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label htmlFor="subject" className={styles.label}>Subject</label>
                                <select id="subject" name="subject" className={styles.select} required>
                                    <option value="">Select a topic</option>
                                    <option value="product">Product Inquiry</option>
                                    <option value="support">Technical Support</option>
                                    <option value="partnership">Partnership</option>
                                    <option value="careers">Careers</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label htmlFor="message" className={styles.label}>Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    className={styles.textarea}
                                    placeholder="Tell us how we can help you..."
                                    rows={5}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={status === 'submitting'}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <svg className={styles.spinner} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="22" y1="2" x2="11" y2="13" />
                                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                        </svg>
                                        Send Message
                                    </>
                                )}
                            </button>

                            {/* Status Message */}
                            {message && (
                                <div className={`${styles.statusMessage} ${status === 'success' ? styles.statusSuccess : styles.statusError}`}>
                                    {status === 'success' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="15" y1="9" x2="9" y2="15" />
                                            <line x1="9" y1="9" x2="15" y2="15" />
                                        </svg>
                                    )}
                                    <span>{message}</span>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Contact Info */}
                    <div className={styles.infoSection}>
                        <h2 className={styles.sectionTitle}>Contact Info</h2>

                        <div className={styles.infoCards}>
                            <div className={styles.infoCard}>
                                <div className={styles.iconWrapper}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                </div>
                                <div className={styles.infoContent}>
                                    <h3 className={styles.infoTitle}>Email Us</h3>
                                    <a href="mailto:info@droneanatomy.com" className={styles.infoLink}>
                                        info@droneanatomy.com
                                    </a>
                                </div>
                            </div>

                            <div className={styles.infoCard}>
                                <div className={styles.iconWrapper}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                </div>
                                <div className={styles.infoContent}>
                                    <h3 className={styles.infoTitle}>WhatsApp</h3>
                                    <a
                                        href="https://wa.me/918130589012"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.infoLink}
                                    >
                                        +91 81305 89012
                                    </a>
                                </div>
                            </div>

                            <div className={styles.infoCard}>
                                <div className={styles.iconWrapper}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                                    </svg>
                                </div>
                                <div className={styles.infoContent}>
                                    <h3 className={styles.infoTitle}>Call Us</h3>
                                    <a href="tel:+918130589012" className={styles.infoLink}>
                                        +91 81305 89012
                                    </a>
                                </div>
                            </div>

                            <div className={styles.infoCard}>
                                <div className={styles.iconWrapper}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <div className={styles.infoContent}>
                                    <h3 className={styles.infoTitle}>Location</h3>
                                    <p className={styles.infoText}>
                                        New Delhi, India
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className={styles.quickActions}>
                            <a
                                href="mailto:info@droneanatomy.com"
                                className={styles.actionButton}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                                Email
                            </a>
                            <a
                                href="https://wa.me/918130589012"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.actionButton}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WhatsApp
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
