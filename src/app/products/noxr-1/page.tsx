import { ComingSoonBanner, Newsletter } from '@/components';
import { label } from 'three/tsl';

export const metadata = {
    title: 'NOXR-1 | DroneAnatomy',
    description: 'NOXR-1 - The ultimate professional drone with advanced AI capabilities and unmatched performance.',
};

export default function Noxr1Page() {
    return (
        <>
            <ComingSoonBanner
                title="Coming Soon"
                // subtitle="AGRICULTURE DRONE, MADE FOR INDIAN CONDITIONS."
                backgroundImage='/images/NOXR-COMING-SOON.jpg'
                features={
                    [
                        { title: "Range", description: "10 km", icon: "" },
                        { title: "Flight Time", description: "80 minutes", icon: "" },
                        { title: "Camera", description: "30x Zoom", icon: "" },
                        { title: "Peripherals", description: "LRF & Thermal integrated", icon: "" },
                    ]
                }
            />
            <Newsletter />
        </>
    );
}
