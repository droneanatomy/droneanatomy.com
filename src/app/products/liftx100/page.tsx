import { ComingSoonBanner, Newsletter } from '@/components';

export const metadata = {
    title: 'LiftX100 | DroneAnatomy',
    description: 'LiftX100 - The ultimate professional drone with advanced AI capabilities and unmatched performance.',
};

export default function LiftX100Page() {
    return (
        <>
            <ComingSoonBanner
                title="Coming Soon"
                backgroundImage='/images/liftx100.jpg'
            />
            <Newsletter />
        </>
    );
}
