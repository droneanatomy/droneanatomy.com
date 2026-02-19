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
            />
            <Newsletter />
        </>
    );
}
