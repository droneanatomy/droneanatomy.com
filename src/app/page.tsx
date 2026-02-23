import { Banner, HomeHeroSection, WireframeTerrain } from '@/components';

export default function Home() {
    return (
        <>
            {/* Hero Section */}
            <HomeHeroSection
                heroVideo="/videos/hero_vid.mp4"
                // heroVideoMobile="/videos/drone-hero-mob.mp4"
                heroVideoMobile="/videos/home-hero-mob.mp4"

            />

            {/* Drone X1 Banner */}
            <Banner
                title="AUTONOMOUS DEFENCE AIRSPACE DOMINANCE SYSTEMS"
                subtitle="(OUTCOMES > SPECIFICATIONS)"
                ctaText="Explore"
                ctaLink="/about"
                // backgroundImage='/images/layout2.jpg'
                backgroundImageMobile='/images/drone-in-the-sky-mob.png'
                backgroundVideo='/videos/drone_in_the_sky.mp4'
                contentPosition="bottom-right"
                overlayStyle="light"
            />

            {/* Enterprise Solutions Banner */}
            {/* <Banner
                title="The infrastructure behind autonomous flight"
                subtitle="We design and build the system that make autonomous aviation reliable, scalable, and inevitable."
                ctaText="Explore"
                ctaLink="/updates"
                backgroundImage='/images/layout3.jpg'
                contentPosition="top-left"
                overlayStyle="dark"
            /> */}

            <WireframeTerrain
                title="The infrastructure behind autonomous flight"
                subtitle="We design and build the system that make autonomous aviation reliable, scalable, and inevitable."
                ctaText="Explore"
                ctaLink="/updates"
                contentPosition="center-left"
                backgroundImageMobile="/images/infra-mob.jpg"
            />

            {/* Drone X1 Banner */}
            <Banner
                title="Indigenous by design"
                subtitle="Our systems are developed and manufactured in India, reducing dependency while building sovereign capability for autonomous aviation."
                ctaText="Know More"
                ctaLink="/products/p10-pro"
                backgroundVideo='/videos/indegenous_design.mp4'
                backgroundImageMobile='/images/indigenous-mob.png'
                contentPosition="top-right"
                overlayStyle="dark"
            />

            {/* Launches Banner */}
            <Banner
                title="From Systems to Missions"
                subtitle="We design from failure -> prevention -> reliability."
                ctaText="Learn More"
                ctaLink="/about"
                // backgroundImage='/images/layout5.jpg'
                backgroundImageMobile='/images/drone-top-view-mob.jpg'
                backgroundVideo='/videos/birds-eye-view.mp4'
                contentPosition="center-left"
                overlayStyle="dark"
                fadeBottomColor='black'
            />
        </>
    );
}
