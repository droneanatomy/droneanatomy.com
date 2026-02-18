import { ComingSoonBanner, Newsletter } from '@/components';

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
                backgroundImage='/images/NOXR-COMING-SOON.png'
            />
            <Newsletter />
        </>
    );
}
