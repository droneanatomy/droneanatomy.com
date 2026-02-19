import { Banner, Slider, Newsletter, FeatureShowcase } from '@/components';

export const metadata = {
    title: 'P10 Pro | DroneAnatomy',
    description: 'P10 Pro - The ultimate professional drone with advanced AI capabilities and unmatched performance.',
};

export default function P10ProPage() {
    return (
        <>
            <Banner
                title="P10 Pro"
                titleSize='hero'
                subtitle="AGRICULTURE DRONE, MADE FOR INDIAN CONDITIONS."
                contentPosition="center-left"
                backgroundImage='/images/p10.png'
                // backgroundVideo='/videos/opening-drone.mp4'
                overlayStyle="none"
                textAlign='center'
                showScrollIndicator
                subtitleSize='sm'
                animate={true}
            />


            <Slider
                slides={[
                    {
                        title: 'P10 Pro Overview',
                        description: "The Drone Anatomy P10 Pro is a high-performance agricultural drone designed for precision spraying, crop monitoring, and autonomous field operations. Engineered for reliability and efficiency, P10 Pro integrates advanced flight control, intelligent payload systems, and rugged airframe construction to operate consistently across large and demanding agricultural environments.",
                        // backgroundImage: '/images/p10pro-overview.png',
                        backgroundVideo: '/videos/dronep10.mp4',
                        // sideVideo: '/videos/opening-drone.mp4',
                        specs: [
                            { label: 'Max Flight Time', value: '30 minutes' },
                            { label: 'Payload Capacity', value: '10kg' },
                            { label: 'SPRAY WIDTH', value: '4 - 6 m' },
                            { label: 'POSITIONING SYSTEM', value: 'GPS Assisted Navigation' },
                        ],
                    },
                ]}
            />

            <Banner
                title="Max Flow Rate"
                titleSize='sm'
                subtitle="Up to 5L/min"
                contentPosition="bottom-left"
                backgroundVideo='/videos/p10-spray.mp4'
                backgroundImageMobile='/images/p10pro-spray-m.png'
                overlayStyle="light"
                textAlign='left'
            />

            <Banner
                title="Night Flying Capability - Equipped with bright LED lights"
                titleSize='sm'
                subtitle="Enhanced Visibility and Safety during nighttime operations"
                contentPosition="top-left"
                backgroundVideo='/videos/night-flight-p10.mp4'
                backgroundImageMobile='/images/p10pro-night-m.png'
                overlayStyle="light"
                textAlign='left'
            />

            <FeatureShowcase
                title="Introducing India's First Ultra-Compact Agricultural Drone!"
                features={[
                    'Light enough to carry anywhere.',
                    'Made for Indian conditions.',
                    'Saves transportation costs.',
                    'Covers 1 Acre in 5 Minutes.',
                    'Ultra Fast battery charging.',
                ]}
                ctaText="Questions? Contact Today!"
                // ctaLink="/contact"
                mainImage="/images/p10pro-bannershot.png"
                galleryImages={[
                    '/images/portable1.png',
                    '/images/portable2.png',
                    '/images/portable3.png',
                    '/images/portable4.png',
                ]}
            />

            <div className="comp-banner">
                <div className="comp-banner-content">
                    <h3>NOTE:</h3>
                    <p>The Drone Anatomy P10 Pro is a high-performance agricultural drone designed for precision spraying, crop monitoring, and autonomous field operations.</p>
                </div>
            </div>
            <Newsletter />
        </>
    );
}
