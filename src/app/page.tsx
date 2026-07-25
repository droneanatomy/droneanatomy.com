import { LazyHeroCluster } from '@/components/HeroCluster/LazyHeroCluster';

export const metadata = {
  title: 'DroneAnatomy - Advanced Aerial Solutions',
  description:
    'DroneAnatomy provides cutting-edge drone technology for enterprise, commercial, and consumer applications.',
};

export default function Home() {
  return (
    <>
      <LazyHeroCluster
        wordmark="DroneAnatomy"
        tagline="We build the autonomous systems that define the next era of flight."
      />
    </>
  );
}
