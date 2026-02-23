import { ComingSoonBanner, Newsletter } from '@/components';

export const metadata = {
    title: 'Cyclops Mini | DroneAnatomy',
    description: 'Cyclops Mini - The ultimate professional drone with advanced AI capabilities and unmatched performance.',
};

export default function CyclopsMiniPage() {
    return (
        <>
            <ComingSoonBanner
                title="Coming Soon"
                backgroundImage='/images/CYCLOPS.jpg'
                features={
                    [
                        { title: "Range", description: "10 km", icon: "" },
                        { title: "Flight Time", description: "80 minutes", icon: "" },
                        { title: "Camera", description: "10x Zoom", icon: "" },
                        { title: "Peripherals", description: "Thermal Integrated", icon: "" },
                    ]
                }
            />
            <Newsletter />
        </>
    );
}
