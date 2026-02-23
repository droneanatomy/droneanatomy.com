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
                        description: "The Drone Anatomy P10 Pro is an ultra-compact agricultural drone and one of India’s first purpose-engineered systems built specifically for Indian farming conditions. Designed to perform in steep terrains, uneven landscapes, and challenging rural environments, the P10 Pro is developed to withstand extreme operational conditions. Its rugged construction, optimized flight dynamics, and resilient system architecture ensure dependable performance even in the harshest agricultural scenarios.",
                        // backgroundImage: '/images/p10pro-overview.png',
                        backgroundVideo: '/videos/drone-open.mp4',
                        backgroundVideoMobile: '/videos/drone-open-mob.mp4',
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
                mainImage="/images/p10pro-bannershot.jpg"
                galleryImages={[
                    '/images/portable1.jpg',
                    '/images/portable2.jpg',
                    '/images/portable3.jpg',
                    '/images/portable4.jpg',
                ]}
            />

            <div className="comp-banner">
                <div className="comp-banner-content">
                    <h3>NOTE:</h3>
                    <p>The Drone Anatomy P10 Pro is 40% smaller and 30% more efficient than standard 10kg agricultural drones.</p>
                </div>
            </div>
            <Newsletter />
        </>
    );
}
