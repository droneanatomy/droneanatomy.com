import styles from './privacy.module.css';

export const metadata = {
    title: 'Privacy Policy | DroneAnatomy',
    description: 'DroneAnatomy privacy policy. Learn how we collect, use, and protect your personal data.',
};

const LAST_UPDATED = 'February 23, 2026';
const COMPANY = 'DAstrionics Technologies Pvt. Ltd.';
const BRAND = 'Drone Anatomy';
const CONTACT_EMAIL = 'info@droneanatomy.com';
const WEBSITE = 'https://droneanatomy.com';

export default function PrivacyPage() {
    return (
        <main className={styles.page}>
            <div className={styles.hero}>
                <div className={styles.heroInner}>
                    <p className={styles.eyebrow}>Legal</p>
                    <h1 className={styles.heroTitle}>Privacy Policy</h1>
                    <p className={styles.heroSub}>
                        Last updated: <time dateTime="2026-02-23">{LAST_UPDATED}</time>
                    </p>
                </div>
            </div>

            <div className={styles.body}>
                <aside className={styles.toc}>
                    <p className={styles.tocLabel}>Contents</p>
                    <ol className={styles.tocList}>
                        <li><a href="#who-we-are">1. Who We Are</a></li>
                        <li><a href="#data-we-collect">2. Data We Collect</a></li>
                        <li><a href="#how-we-use">3. How We Use Your Data</a></li>
                        <li><a href="#third-parties">4. Third-Party Services</a></li>
                        <li><a href="#cookies">5. Cookies & Analytics</a></li>
                        <li><a href="#data-retention">6. Data Retention</a></li>
                        <li><a href="#your-rights">7. Your Rights</a></li>
                        <li><a href="#security">8. Security</a></li>
                        <li><a href="#children">9. Children&apos;s Privacy</a></li>
                        <li><a href="#changes">10. Changes to This Policy</a></li>
                        <li><a href="#contact-us">11. Contact Us</a></li>
                    </ol>
                </aside>

                <article className={styles.content}>

                    <p className={styles.intro}>
                        {BRAND} is a product of <strong>{COMPANY}</strong>. We are committed to protecting your
                        personal information and being transparent about how we handle it. This policy explains
                        what data we collect through <a href={WEBSITE}>{WEBSITE}</a>, why we collect it, and
                        your rights regarding it.
                    </p>

                    {/* 1 */}
                    <section id="who-we-are">
                        <h2>1. Who We Are</h2>
                        <p>
                            <strong>{COMPANY}</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the {BRAND} website
                            at <a href={WEBSITE}>{WEBSITE}</a>. We design and manufacture professional
                            UAV / drone systems based in New Delhi, India.
                        </p>
                        <p>
                            For privacy‑related queries, you can reach our data controller at{' '}
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                        </p>
                    </section>

                    {/* 2 */}
                    <section id="data-we-collect">
                        <h2>2. Data We Collect</h2>
                        <p>We collect only the data you voluntarily provide or that is generated automatically during your visit.</p>

                        <h3>2a. Contact Form</h3>
                        <p>When you submit our contact form, we collect:</p>
                        <ul>
                            <li><strong>Full name</strong></li>
                            <li><strong>Email address</strong></li>
                            <li><strong>Phone number</strong> (optional)</li>
                            <li><strong>Subject &amp; message</strong> you write</li>
                        </ul>
                        <p>This information is transmitted to and stored by <strong>Formspree</strong> (our form processing service) and forwarded to our team email.</p>

                        <h3>2b. Newsletter</h3>
                        <p>
                            If you subscribe to our newsletter, we collect your <strong>email address</strong> solely
                            for the purpose of sending drone-related updates and product announcements.
                        </p>

                        <h3>2c. Automatically Collected Data</h3>
                        <p>When you visit our website, the following may be collected automatically:</p>
                        <ul>
                            <li>IP address (anonymised by Cloudflare)</li>
                            <li>Browser type and version</li>
                            <li>Pages visited and time spent</li>
                            <li>Referring URL</li>
                            <li>Device type (desktop / mobile)</li>
                        </ul>
                        <p>This data is processed at the network level by <strong>Cloudflare</strong> and used only for security and aggregate performance analysis. We do not have access to individual user records.</p>
                    </section>

                    {/* 3 */}
                    <section id="how-we-use">
                        <h2>3. How We Use Your Data</h2>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Purpose</th>
                                    <th>Legal Basis</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Name, email, phone, message</td>
                                    <td>Respond to your enquiry</td>
                                    <td>Legitimate interest / contract</td>
                                </tr>
                                <tr>
                                    <td>Email (newsletter)</td>
                                    <td>Send product updates &amp; news</td>
                                    <td>Consent</td>
                                </tr>
                                <tr>
                                    <td>Analytics &amp; network data</td>
                                    <td>Site security &amp; performance</td>
                                    <td>Legitimate interest</td>
                                </tr>
                            </tbody>
                        </table>
                        <p>We do <strong>not</strong> sell, rent, or trade your personal data to third parties for marketing purposes.</p>
                    </section>

                    {/* 4 */}
                    <section id="third-parties">
                        <h2>4. Third-Party Services</h2>
                        <p>We use a small number of trusted third-party services:</p>
                        <ul>
                            <li>
                                <strong>Formspree</strong> — handles contact form submissions.
                                Their privacy policy: <a href="https://formspree.io/legal/privacy-policy" target="_blank" rel="noopener noreferrer">formspree.io/legal/privacy-policy</a>
                            </li>
                            <li>
                                <strong>Cloudflare</strong> — DNS, CDN, DDoS protection, and web analytics.
                                Their privacy policy: <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">cloudflare.com/privacypolicy</a>
                            </li>
                            <li>
                                <strong>GitHub</strong> — source code hosting (no user data involved).
                            </li>
                        </ul>
                        <p>Each third party is bound by their own privacy policies. We encourage you to review them.</p>
                    </section>

                    {/* 5 */}
                    <section id="cookies">
                        <h2>5. Cookies &amp; Analytics</h2>
                        <p>
                            Our website uses <strong>Cloudflare Web Analytics</strong>, which is a privacy-first,
                            cookie-free analytics solution. It does <strong>not</strong> use cookies, fingerprint
                            users, or track individuals across sites. No analytics cookies are set by us.
                        </p>
                        <p>
                            If your browser or extensions set functional cookies (e.g. for preferences), those are
                            handled entirely client-side and are not transmitted to our servers.
                        </p>
                    </section>

                    {/* 6 */}
                    <section id="data-retention">
                        <h2>6. Data Retention</h2>
                        <ul>
                            <li><strong>Contact form submissions</strong> — retained in our inbox for up to 2 years, then deleted.</li>
                            <li><strong>Newsletter email addresses</strong> — retained until you unsubscribe.</li>
                            <li><strong>Analytics data</strong> — aggregate only; no personally identifiable data retained by us.</li>
                        </ul>
                    </section>

                    {/* 7 */}
                    <section id="your-rights">
                        <h2>7. Your Rights</h2>
                        <p>Depending on your jurisdiction, you may have the right to:</p>
                        <ul>
                            <li><strong>Access</strong> — request a copy of the data we hold about you.</li>
                            <li><strong>Rectification</strong> — ask us to correct inaccurate data.</li>
                            <li><strong>Erasure</strong> — request deletion of your data (&quot;right to be forgotten&quot;).</li>
                            <li><strong>Restriction</strong> — ask us to limit how we process your data.</li>
                            <li><strong>Portability</strong> — request your data in a machine-readable format.</li>
                            <li><strong>Withdraw consent</strong> — unsubscribe from the newsletter at any time.</li>
                            <li><strong>Lodge a complaint</strong> — with your national data protection authority.</li>
                        </ul>
                        <p>
                            To exercise any of these rights, email us at{' '}
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will respond within 30 days.
                        </p>
                    </section>

                    {/* 8 */}
                    <section id="security">
                        <h2>8. Security</h2>
                        <p>
                            We take reasonable technical and organisational measures to protect your data, including
                            HTTPS encryption on all pages, Cloudflare DDoS protection, and access controls on our
                            internal systems. However, no method of transmission over the internet is 100% secure,
                            and we cannot guarantee absolute security.
                        </p>
                    </section>

                    {/* 9 */}
                    <section id="children">
                        <h2>9. Children&apos;s Privacy</h2>
                        <p>
                            Our website is not directed at children under the age of 13. We do not knowingly collect
                            personal data from children. If you believe a child has submitted data to us, please
                            contact us and we will delete it promptly.
                        </p>
                    </section>

                    {/* 10 */}
                    <section id="changes">
                        <h2>10. Changes to This Policy</h2>
                        <p>
                            We may update this policy from time to time. When we do, we will revise the
                            &quot;Last updated&quot; date at the top of this page. We encourage you to review the policy
                            periodically. Continued use of the website after changes constitutes acceptance of the
                            updated policy.
                        </p>
                    </section>

                    {/* 11 */}
                    <section id="contact-us">
                        <h2>11. Contact Us</h2>
                        <p>If you have any questions or concerns about this Privacy Policy, please reach out:</p>
                        <address className={styles.address}>
                            <strong>{COMPANY}</strong><br />
                            New Delhi, India<br />
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br />
                            <a href="tel:+918130589012">+91 81305 89012</a>
                        </address>
                    </section>

                </article>
            </div>
        </main>
    );
}
