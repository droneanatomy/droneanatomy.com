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
            {/* 
            <Slider
                slides={[
                    {
                        title: 'Making Autonomous Flight Inevitable',
                        description: 'DroneAnatomy has gained worldwide attention for a series of historic milestones. We are the first company to achieve fully autonomous long-range drone delivery, and our technology powers critical infrastructure inspections across the globe.',
                        backgroundImage: '/images/aboutlayout2.jpg',
                    },
                    {
                        title: 'Innovation First',
                        description: 'Our commitment to innovation drives everything we do. With over 100 patents and a world-class engineering team, we continue to push the boundaries of what is possible in aerial technology.',
                        backgroundImage: '',
                    },
                    {
                        title: 'Global Impact',
                        description: 'From agriculture to emergency response, our drones are making a difference in communities worldwide. We partner with organizations to deliver life-saving supplies to remote areas.',
                        backgroundImage: '',
                    },
                ]}
            /> */}


            {/* <Banner
                title="Our Vision"
                subtitle="A world where drones seamlessly integrate into everyday operations, making work safer, more efficient, and more sustainable."
                contentPosition="center-left"
                backgroundImage="/images/aboutlayout4.jpg"
                overlayStyle="dark"
            /> */}

            <CardGrid
                sectionTitle="Our Journey"
                cards={[
                    {
                        preTitle: '2015',
                        title: 'The Beginning',
                        description: "Saurabh started with Drones at the age of 15 and got Awarded in the National Science Exhibition.",
                        image: '/images/j4.JPG',
                    },
                    {
                        preTitle: '2016',
                        title: 'Explored industry and met Mayank.',
                        description: "When two minds with a shared passion come together, great things happen - let's make magic!",
                        image: '/images/j6.JPG',
                    },
                    {
                        preTitle: '2017',
                        title: 'Excited from the business potential started with their first office.',
                        description: "The feeling of making money together as a team is like rocket fuel for your business - let's keep the momentum going and reach for the stars!",
                        image: '/images/j9.JPG',
                    },
                    {
                        preTitle: '2018',
                        title: 'Started delivering Made in India drones to Indian Army & met Dipanshu.',
                        description: "Our first product delivery is just the beginning - we're paving the way for a future full of innovation and success!",
                        image: '/images/j12.JPG',
                    },
                    {
                        preTitle: '2019',
                        title: 'Started making high pay load drones which market required.',
                        description: "Smart entrepreneurs pivot with the market - by adapting to changing demands, we're not just surviving, we're thriving!",
                        image: '/images/j.JPG',
                    },
                    {
                        preTitle: '2020',
                        title: 'Actual implementation of high pay load drones during covid for santization purposes.',
                        description: "Risk-taking meets innovation - using drones to sanitize in the time of COVID, we're not just adapting, we're changing the game!",
                        image: '/images/j10.JPG',
                    },
                    {
                        preTitle: '2021',
                        title: 'Advancement of business growth',
                        description: "Advancing in business is not just about reaching new heights - it's about pushing past boundaries, breaking through barriers, and achieving the impossible!",
                        image: '/images/j11.JPG',
                    },
                    {
                        preTitle: '2022',
                        title: 'THROTTLE UP :)',
                        description: "'Building a team is not just about growing headcount - it's about cultivating a community of leaders, empowering individuals to reach their full potential, and achieving collective greatness!'  so founded DAstrionics technologies Pvt Ltd with a vison to make in India for the world.",
                        image: '/images/j3.JPG',
                    },
                    {
                        preTitle: '2023',
                        title: 'Next-Gen Platform',
                        description: 'Unveiled our next-generation drone platform with revolutionary modular design.',
                        image: '/images/j5.JPG',
                    },
                    {
                        preTitle: '2024',
                        title: 'Service Expansion',
                        description: 'Launched comprehensive drone-as-a-service offerings for businesses of all sizes.',
                        image: '/images/j8.JPG',
                    },
                    {
                        preTitle: '2025',
                        title: 'Autonomous Fleet',
                        description: 'Introduced fully autonomous fleet management solutions for logistics companies.',
                        image: '/images/DSC07310.JPG',
                    },
                    {
                        preTitle: '2026',
                        title: 'Global Expansion',
                        description: 'Operating in over 30 countries, providing cutting-edge drone solutions worldwide.',
                        image: '/images/DSC07310.JPG',
                    },
                ]}
            />


            <OurTeam
                members={[
                    { name: 'Saurabh Jha', role: 'Co-Founder & CEO', image: '/images/j3.JPG' },
                    { name: 'Mayank', role: 'Co-Founder & COO', image: '/images/j6.JPG' },
                    { name: 'Dipanshu', role: 'Co-Founder & CTO', image: '/images/j9.JPG' },
                    { name: 'Rahul Sharma', role: 'Lead Engineer', image: '/images/j12.JPG' },
                    { name: 'Priya Patel', role: 'Avionics Designer', image: '/images/j.JPG' },
                    { name: 'Vikram Singh', role: 'Drone Pilot Lead', image: '/images/j10.JPG' },
                    { name: 'Ananya Gupta', role: 'Software Engineer' },
                    { name: 'Arjun Mehta', role: 'Mechanical Engineer' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                    { name: 'Neha Verma', role: 'Operations Manager' },
                ]}
            />

            <Newsletter />
        </>
    );
}
