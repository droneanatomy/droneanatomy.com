/* THE PRODUCT INDEX.

   READ THIS BEFORE ADDING ANYTHING ELSE HERE. The three entries below the
   Mini — Drone X1, Drone Pro and Drone Lite — are template placeholders,
   not products. Their CTAs point at /products/drone-x1, /products/drone-pro
   and /products/drone-lite, and NONE of those routes exist: the real ones
   are p10-pro, mini, noxr-1, cyclops-3, cyclops-mini and liftx100. Every
   one of those three buttons is a 404.

   They are left standing because removing them is a content decision about
   what this company sells, which is not mine to make. But they are the
   reason this page cannot be trusted as a catalogue, and anything added
   next to them inherits that. The fix is to replace them with the routes
   that exist, and it should happen before this page is linked to from
   anywhere prominent. */

import { Banner } from '@/components';

export const metadata = {
    title: 'Products | DroneAnatomy',
    description:
        'Explore our range of advanced drone products — the P10 Pro agricultural platform, the compact Mini, and more.',
};

export default function ProductsPage() {
    return (
        <>
            <Banner
                title="Our Products"
                subtitle="Discover our complete range of advanced aerial vehicles, designed for professionals and enthusiasts alike."
                contentPosition="center-left"
                overlayStyle="dark"
            />

            {/* FIRST, because it is the only entry on this page with a
                finished product page behind it — see the note at the top.
                An index whose working link is buried under three broken
                ones is worse than one that leads with the real thing. */}
            <Banner
                title="Mini"
                subtitle="The smallest complete airframe we fly. Folds into a case that travels with the crew, and runs the same stack as every other aircraft on the fleet."
                ctaText="View the Mini"
                ctaLink="/products/mini"
                contentPosition="center-left"
                overlayStyle="dark"
            />

            <Banner
                title="Drone X1"
                subtitle="Our flagship autonomous drone featuring 8K imaging, 60-minute flight time, and AI-powered obstacle avoidance. Built for professionals who demand excellence."
                ctaText="Learn More"
                ctaLink="/products/drone-x1"
                contentPosition="center-left"
                overlayStyle="dark"
            />

            <Banner
                title="Drone Pro"
                subtitle="Professional-grade aerial photography and videography. 4K HDR video, advanced stabilization, and intelligent flight modes."
                ctaText="Learn More"
                ctaLink="/products/drone-pro"
                contentPosition="center-left"
                overlayStyle="dark"
            />

            <Banner
                title="Drone Lite"
                subtitle="Compact and portable without compromising on quality. Perfect for travel and everyday adventures."
                ctaText="Learn More"
                ctaLink="/products/drone-lite"
                contentPosition="center-left"
                overlayStyle="dark"
            />
        </>
    );
}
