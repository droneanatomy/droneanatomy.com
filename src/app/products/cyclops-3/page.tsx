import { ComingSoonBanner, Newsletter } from '@/components';

export const metadata = {
    title: 'Cyclops 3 | DroneAnatomy',
    description: 'Cyclops 3 - The ultimate professional drone with advanced AI capabilities and unmatched performance.',
};

export default function Cyclops3Page() {
    return (
        <>
            <ComingSoonBanner
                title="Coming Soon"
                backgroundImage='/images/CYCLOPS3.jpg'
                features={
                    [
                        { title: "Range", description: "150 km", icon: "" },
                        { title: "Flight Time", description: "180 minutes", icon: "" },
                        { title: "Camera", description: "150x Zoom", icon: "" },
                        { title: "Operational Altitude", description: "6500m", icon: "" },
                    ]
                }
            />
            <Newsletter />
        </>
    );
}
