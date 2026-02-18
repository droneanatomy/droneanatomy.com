import React from 'react';
import Image from 'next/image';
import styles from './OurTeam.module.css';

export interface TeamMember {
    name: string;
    role: string;
    image?: string;
}

export interface OurTeamProps {
    title?: string;
    subtitle?: string;
    members: TeamMember[];
    className?: string;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export const OurTeam: React.FC<OurTeamProps> = ({
    title = 'Our Team',
    subtitle = "We're a passionate group of engineers, designers, and pilots dedicated to building the future of autonomous flight.",
    members,
    className = '',
}) => {
    return (
        <section className={`${styles.section} ${className}`}>
            <div className={styles.container}>
                <div className="">

                    <h2 className={styles.sectionTitle}>{title}</h2>
                    {subtitle && (
                        <p className={styles.sectionSubtitle}>{subtitle}</p>
                    )}
                </div>

                <div className={styles.grid}>
                    {members.map((member, index) => (
                        <div key={index} className={styles.memberCard}>
                            <div className={styles.avatarWrapper}>
                                {member.image ? (
                                    <Image
                                        src={member.image}
                                        alt={member.name}
                                        width={128}
                                        height={128}
                                        className={styles.avatar}
                                    />
                                ) : (
                                    <div className={styles.avatarPlaceholder}>
                                        {getInitials(member.name)}
                                    </div>
                                )}
                            </div>
                            <span className={styles.memberName}>
                                {member.name}
                            </span>
                            <span className={styles.memberRole}>
                                {member.role}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default OurTeam;
