import { Banner, StatsSection, CardGrid, Slider, Newsletter, OurTeam } from '@/components';

export const metadata = {
    title: 'About | DroneAnatomy',
    description: 'Learn about DroneAnatomy - our mission, vision, and the team behind advanced aerial technology.',
};

export default function AboutPage() {
    return (
        <>
            <Banner
                title="Our Belief"
                subtitle="The future of flight is autonomous and building it responsibly is one of the most important engineering challenges of our time."
                contentPosition="bottom-center"
                backgroundImage="/images/mission_banner.png"
                textAlign="center"
                titleSize='lg'
                subtitleSize='xl'
                overlayStyle='light'
            />

            <StatsSection
                stats={[
                    { value: 1200, label: 'Hours of Flight', suffix: '+' },
                    { value: 10, label: 'Build over time', suffix: '+' },
                    { value: 9, label: 'Systems in motion', suffix: '+' },
                    { value: 3000, label: 'Total Landings', suffix: '+' },
                ]}
            />

            <CardGrid
                sectionTitle="Our Journey"
                cards={[
                    {
                        preTitle: '2015',
                        title: 'The Beginning',
                        description: "Saurabh started with Drones at the age of 15 and got Awarded in the National Science Exhibition.",
                        image: '/images/journey/j-2015.jpg',
                    },
                    {
                        preTitle: '2016',
                        title: 'Explored industry and met Mayank.',
                        description: "When two minds with a shared passion come together, great things happen - let's make magic!",
                        image: '/images/journey/j-2016.jpg',
                    },
                    {
                        preTitle: '2017',
                        title: 'Excited from the business potential started with their first office.',
                        description: "The feeling of making money together as a team is like rocket fuel for your business - let's keep the momentum going and reach for the stars!",
                        image: '/images/journey/j-2017.jpg',
                    },
                    {
                        preTitle: '2018',
                        title: 'Started delivering Made in India drones to Indian Army & met Dipanshu.',
                        description: "Our first product delivery is just the beginning - we're paving the way for a future full of innovation and success!",
                        image: '/images/journey/j-2018.jpg',
                    },
                    {
                        preTitle: '2019',
                        title: 'Started making high pay load drones which market required.',
                        description: "Smart entrepreneurs pivot with the market - by adapting to changing demands, we're not just surviving, we're thriving!",
                        image: '/images/journey/j-2019.jpg',
                    },
                    {
                        preTitle: '2020',
                        title: 'Actual implementation of high pay load drones during covid for santization purposes.',
                        description: "Risk-taking meets innovation - using drones to sanitize in the time of COVID, we're not just adapting, we're changing the game!",
                        image: '/images/journey/j-2020.jpg',
                    },
                    {
                        preTitle: '2021',
                        title: 'Advancement of business growth',
                        description: "Advancing in business is not just about reaching new heights - it's about pushing past boundaries, breaking through barriers, and achieving the impossible!",
                        image: '/images/journey/j-2021.jpg',
                    },
                    {
                        preTitle: '2022',
                        title: 'THROTTLE UP :)',
                        description: "'Building a team is not just about growing headcount - it's about cultivating a community of leaders, empowering individuals to reach their full potential, and achieving collective greatness!'  so founded DAstrionics technologies Pvt Ltd with a vison to make in India for the world.",
                        image: '/images/journey/j-2022.jpg',
                    },
                    {
                        preTitle: '2023',
                        title: 'Service Expansion',
                        description: 'Launched comprehensive drone-as-a-service offerings for businesses of all sizes.',
                        image: '/images/journey/j-2023.jpg',

                    },
                    {
                        preTitle: '2024',
                        title: 'Next-Gen Platform',
                        description: 'Unveiled our next-generation drone platform with revolutionary modular design.',
                        image: '/images/portable1.jpg',
                    },
                    {
                        preTitle: '2025',
                        title: 'DGCA Type Certification Achieved',
                        description: 'We inaugurated our advanced manufacturing facility dedicated to defense-grade drone systems.',
                        image: '/images/journey/j-2025.jpg',
                    },
                    {
                        preTitle: '2026',
                        title: 'Deployment. Defence. Dominance.',
                        description: 'Indigenous platforms launched.',
                        image: '/images/journey/j-2026.jpg',
                    },
                ]}
            />


            <OurTeam
                members={[
                    { name: 'Saurabh Jha', role: 'Co-Founder & CEO', image: '/images/team/saurabh.jpg', },
                    { name: 'Mayank Sharma', role: 'Co-Founder & COO', image: '/images/team/mayank.jpg', },
                    { name: 'Dipanshu Purohit', role: 'Co-Founder & CMO', image: '/images/team/deepanshu.jpg', },
                    { name: 'Deepak Maheshwari', role: 'Advisor', image: '/images/team/deepak_maheshwari.jpg', },
                    { name: 'G. S. Bedi', role: 'Advisor', image: '/images/team/gs-bedi.jpg', },
                    { name: 'Jogesh Grover', role: 'Advisor', image: '/images/team/jogesh-grover.webp', },
                    { name: 'Aniket Gupta', role: 'Head of Software', image: '/images/team/aniket.jpg', },
                    { name: 'Suman Pal', role: 'Head of Design', image: '/images/team/suman-new.jpg', },
                    { name: 'Harsh Kumar', role: 'UAV Pilot', image: '/images/team/harsh.jpg', },
                    { name: 'Vikram Chaudhary', role: 'R&D', image: '/images/team/vikram-chaudhary.jpg', },
                    { name: 'Ramesh Patil', role: 'Project Manager', image: '/images/team/ramesh.jpg', },
                    { name: 'Yakshat', role: 'Media Manager', image: '/images/team/yakshat.jpg', },
                    { name: 'Sanat Chaudhary', role: 'Business Development', image: '/images/sanat.jpg', },
                    { name: 'Neha Verma', role: 'Operations Manager', image: '/images/neh.jpg', },
                    { name: 'Neha Verma', role: 'Operations Manager', image: '/images/neh.jpg', },
                    { name: 'Neha Verma', role: 'Operations Manager', image: '/images/neh.jpg', },

                ]}
            />

            <Newsletter />
        </>
    );
}
