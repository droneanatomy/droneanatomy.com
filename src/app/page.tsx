import { Banner, HomeHeroSection, WireframeTerrain } from '@/components';

export default function Home() {
    return (
        <>
            {/* Hero Section */}
            <HomeHeroSection heroVideo="/videos/hero.mp4" />

            {/* Drone X1 Banner */}
            <Banner
                title="AUTONOMOUS DEFENCE AIRSPACE DOMINANCE SYSTEMS"
                subtitle="(OUTCOMES > SPECIFICATIONS)"
                ctaText="Explore"
                ctaLink="/about"
                // backgroundImage='/images/layout2.jpg'
                // backgroundImageMobile='/images/layout2_mob.jpg'
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
            />

            {/* Drone X1 Banner */}
            <Banner
                title="Indigenous by design"
                subtitle="Our systems are developed and manufactured in India, reducing dependency while building sovereign capability for autonomous aviation."
                ctaText="Know More"
                ctaLink="/products/p10-pro"
                backgroundVideo='/videos/indegenous.mp4'
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
                backgroundVideo='/videos/drone_topview.mp4'
                contentPosition="center-left"
                overlayStyle="dark"
                fadeBottomColor='black'
            />
        </>
    );
}
