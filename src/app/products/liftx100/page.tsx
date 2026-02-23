import { ComingSoonBanner, Newsletter } from '@/components';

export const metadata = {
    title: 'LiftX100 | DroneAnatomy',
    description: 'LiftX100 - The ultimate professional drone with advanced AI capabilities and unmatched performance.',
};

const IconRange = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" />
    </svg>
);

const IconFlightTime = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);

const IconAltitude = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
    </svg>
);

const IconRedundancy = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
);

export default function LiftX100Page() {
    return (
        <>
            <ComingSoonBanner
                title="Coming Soon"
                backgroundImage='/images/liftx100.jpg'
                features={[
                    { title: "Range", description: "50 km", icon: IconRange },
                    { title: "Flight Time", description: "30 minutes", icon: IconFlightTime },
                    { title: "Operational Altitude", description: "4000m", icon: IconAltitude },
                    { title: "Redundancy", description: "Integrated Parachute", icon: IconRedundancy },
                ]}
            />
            <Newsletter />
        </>
    );
}
