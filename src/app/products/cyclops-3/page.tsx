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
                backgroundImage='/images/CYCLOPS3.png'
            />
            <Newsletter />
        </>
    );
}
