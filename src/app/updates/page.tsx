import { Banner, ContentGrid, ContentItem } from '@/components';

export const metadata = {
    title: 'Updates | DroneAnatomy',
    description: 'Latest news and updates from DroneAnatomy. Product announcements, company news, and industry insights.',
};

// News articles data
const newsArticles: ContentItem[] = [
    {
        id: '1',
        title: 'From 10th-grade Student to Drone Startup Founder',
        excerpt: 'DD National profiles an inspiring drone startup journey.',
        image: 'https://img.youtube.com/vi/wzhFkAOHIrs/hqdefault.jpg',
        date: 'Jan 5, 2026',
        category: 'DD National',
        slug: '10th-grade-student-drone-founder',
        externalUrl: 'https://www.youtube.com/watch?v=wzhFkAOHIrs',
    },
    {
        id: '2',
        title: '3 युवाओं की कहानी जो आपको याद दिलाएगी थ्री इडियट्स',
        excerpt: 'The Great India highlights inspiring youth stories.',
        image: 'https://pbs.twimg.com/media/G5J7gEEa4AAUkr5?format=jpg&name=900x900',
        date: 'Nov 8, 2025',
        category: 'The Great India',
        slug: 'three-youths-story-three-idiots',
        externalUrl: 'https://x.com/thegreatindiav/status/1986967154231525392',
    },
    {
        id: '3',
        title: 'India’s Digital Revolution: From 25 Cr to 97 Cr Internet Users',
        excerpt: 'DD India explores India’s massive digital transformation.',
        image: 'https://img.youtube.com/vi/IQPYPF3ohXA/hqdefault.jpg',
        date: 'Sep 18, 2025',
        category: 'DD India',
        slug: 'indias-digital-revolution-internet-users',
        externalUrl: 'https://www.youtube.com/watch?v=IQPYPF3ohXA',
    },
    {
        id: '4',
        title: 'Drone Anatomy',
        excerpt: 'DD National feature highlighting Drone Anatomy.',
        image: '/images/da-news.png',
        date: 'Nov 1, 2025',
        category: 'DD National',
        slug: 'drone-anatomy-dd-national',
        externalUrl: 'https://www.instagram.com/reel/DQgrNBFD7Pd/',
    },
    {
        id: '5',
        title: 'डिग्री छोड़ थाम लिया ड्रोन',
        excerpt: 'News18 Hindi story on young innovators building drones.',
        image: 'https://images.news18.com/ibnkhabar/uploads/2025/11/three-idiots-real-hero-are-drone-anatomy-founders-2025-11-746e0a04cdfb920af603f9b9859a5c4a.jpg?impolicy=website&width=640&height=480',
        date: 'Nov 7, 2025',
        category: 'News18 Hindi',
        slug: 'degree-chhod-diya-drone',
        externalUrl: 'https://hindi.news18.com/news/business/money-making-tips-drone-anatomy-3-indian-youths-create-history-by-making-drones-for-agriculture-and-indian-army-ws-ln-9825790.html',
    },
    {
        id: '6',
        title: 'Deeptech, Not Policy Alone, Will Drive India’s Drone Growth',
        excerpt: 'Drone Anatomy CEO shares insights on India’s drone ecosystem.',
        image: 'https://techobserver.in/wp-content/uploads/2025/11/Saurabh-Jha-Founder-and-CEO-of-Drone-Anatomy-1068x601.webp',
        date: 'Nov 3, 2025',
        category: 'Tech Observer',
        slug: 'deeptech-will-drive-indias-drone-growth',
        externalUrl: 'https://techobserver.in/news/interviews/deeptech-not-policy-alone-will-drive-indias-drone-growth-drone-anatomy-ceo-318586/',
    },
    {
        id: '8',
        title: 'सौरव झा की उड़ान: गांव के लड़के ने बनाया देशी ड्रोन',
        excerpt: 'Inspirational story of Drone Anatomy founder on DD National.',
        image: 'https://img.youtube.com/vi/lc4bBdl1VDs/hqdefault.jpg',
        date: 'Nov 15, 2025',
        category: 'DD National',
        slug: 'saurabh-jha-ki-udaan',
        externalUrl: 'https://www.youtube.com/watch?v=lc4bBdl1VDs',
    },
    {
        id: '9',
        title: 'Tech for Growth',
        excerpt: 'DD News highlights technology-led growth initiatives.',
        image: 'https://pbs.twimg.com/amplify_video_thumb/1967503475258077185/img/NVpz_utGWyBPYpvm.jpg',
        date: 'Sep 15, 2025',
        category: 'DD News',
        slug: 'tech-for-growth-dd-news',
        externalUrl: 'https://x.com/DDNewslive/status/1967504270892425718',
    },

    {
        id: '10',
        title: 'India–Israel Defence Partnership Enters New Phase',
        excerpt: 'Zee News reports on AI and counter-drone collaborations.',
        image: 'https://english.cdn.zeenews.com/sites/default/files/styles/zm_700x400/public/2025/11/24/1867512-israel-india-pib.jpg?im=Resize=(700,400)',
        date: 'Nov 24, 2025',
        category: 'Zee News',
        slug: 'india-israel-defence-ai-drones',
        externalUrl: 'https://zeenews.india.com/india/india-israel-defence-partnership-enters-new-phase-with-ai-and-counter-drone-collaborations-2988583.html',
    },
    {
        id: '11',
        title: 'भारत–इजराइल रक्षा सहयोग का नया दौर',
        excerpt: 'Business World Hindi covers AI, drones, and digital border security.',
        image: 'https://cms.bwhindi.com/story-images/1764319626.jpg',
        date: 'Nov 28, 2025',
        category: 'Business World Hindi',
        slug: 'bharat-israel-raksha-sahyog-ai-drone',
        externalUrl: 'https://www.bwhindi.com/businessnews/india-israel-defense-cooperation-a-new-phase-of-border-security-and-technological-modernization-67986.html',
    },
];

export default async function UpdatesPage() {
    // Fetch blog posts from Hashnode

    return (
        <>
            <Banner
                title="Updates"
                titleSize='hero'
                subtitle="Enter your email to sign up for DroneAnatomy updates"
                contentPosition="center"
                // backgroundImage='/images/updates.png'
                backgroundImageMobile='/images/updates-hero-mob.jpg'
                backgroundVideo='/videos/updates_hero.mp4'
                textAlign='center'
                overlayStyle="dark"
                showEmailSignup
            />

            <ContentGrid
                title="Latest News"
                subtitle="Follow our journey as we continue to push the boundaries of drone technology"
                items={newsArticles}
                basePath="/updates"
                viewAllText="View All News"
                showLessText="Show Less"
            />
        </>
    );
}
