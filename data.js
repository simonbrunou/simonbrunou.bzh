// Shared data for simonbrunou.bzh and resume
// Edit this file to update both the website and the resume.
window.RESUME_DATA = {
    personal: {
        name: "Simon Brunou",
        firstName: "Simon",
        lastName: "Brunou",
        email: "simon.brunou@proton.me",
        phone: "+33621041865",
        phoneDisplay: { en: "+33 621 041 865", fr: "06 21 04 18 65" },
        location: {
            en: "Saint-Nolff, Brittany, France",
            fr: "Saint-Nolff, Bretagne, France",
        },
        githubUrl: "https://github.com/simonbrunou",
        githubDisplay: "github.com/simonbrunou",
        linkedinUrl:
            "https://www.linkedin.com/in/simon-brunou-a7a5a489",
        linkedinDisplay: "linkedin.com/in/simon-brunou",
        websiteUrl: "https://simonbrunou.bzh",
    },

    availability: {
        open: true,
        label: {
            en: "Open to opportunities",
            fr: "Ouvert aux opportunités",
        },
    },

    title: {
        en: "Fullstack Developer",
        fr: "Développeur Fullstack",
    },

    about: {
        en: "Committed, motivated and serious Fullstack Developer with experience in mobile application development, project management, client communication and regular product delivery. Based in Brittany, France, I build robust applications across the entire stack — from mobile and desktop to backend and middleware — with a passion for Rust and systems programming.",
        fr: "Développeur Fullstack impliqué, motivé et sérieux avec de l'expérience dans le développement d'applications mobiles, la gestion de projets, la communication client et la livraison régulière de produits. Basé en Bretagne, je conçois des applications robustes sur l'ensemble de la stack — du mobile et desktop au backend et middleware — avec une passion pour Rust et la programmation système.",
    },

    skills: {
        languages: [
            "Rust",
            "Dart",
            "Kotlin",
            "Swift",
            "Java",
            "JavaScript",
            "TypeScript",
            "Python",
            "C",
        ],
        frameworks: [
            "Flutter",
            "React Native",
            "Android",
            "iOS",
            "React",
            "Electron",
            "Angular",
            "Spring Boot",
            "Node.js",
        ],
        tools: [
            "Git",
            "Docker",
            "Proxmox",
            "GitLab CI/CD",
            "Terraform",
            "Figma",
        ],
    },

    skillCategoryLabels: {
        languages: { en: "Languages", fr: "Langages" },
        frameworks: { en: "Frameworks", fr: "Frameworks" },
        tools: { en: "Tools & DevOps", fr: "Outils" },
    },

    experience: [
        {
            role: {
                en: "Fullstack Developer",
                fr: "Développeur Fullstack",
            },
            company: {
                en: "Confidential Startup",
                fr: "Startup (confidentiel)",
            },
            startDate: "2025-02",
            endDate: "2025-07",
            period: {
                en: "Feb 2025 — Jul 2025",
                fr: "Février 2025 - Juillet 2025",
            },
            description: {
                en: [
                    "Built mobile companion POC application in Dart and Flutter: interaction with connected device, user account management, and web services consumption",
                    "Developed Rust libraries for low-level communication with a connected device",
                ],
                fr: [
                    "Développement d'une application mobile compagnon (POC) en Dart et Flutter : interaction avec l'objet connecté, gestion de compte utilisateur et consommation de web services",
                    "Développement de bibliothèques en Rust pour la communication bas niveau avec un objet connecté",
                ],
            },
        },
        {
            role: {
                en: "Fullstack Developer",
                fr: "Développeur Fullstack",
            },
            company: { en: "BYSTAMP", fr: "BYSTAMP" },
            startDate: "2017-07",
            endDate: "2025-02",
            period: {
                en: "Jul 2017 — Feb 2025",
                fr: "Juillet 2017 - Février 2025",
            },
            description: {
                en: [
                    "PDF signing app: Android (Kotlin) and iOS (Swift) mobile apps, then Flutter (Dart), for signing PDF documents via a Bluetooth-connected stamp",
                    "PDF signing app: desktop applications for Windows, macOS and Linux with React and Electron",
                    "Connected device management: onboarding flows, Bluetooth pairing, firmware updates (OTA) and stamp configuration on mobile and desktop",
                    "Development and maintenance of backend web-services in Java/Kotlin with Spring Boot, then migration to Rust: account, document and signature management",
                    "Middleware development in Rust and C for low-level communication with the connected stamp",
                    "Development, documentation and continuous delivery of SDKs in Swift, Kotlin, Rust, JavaScript, TypeScript and C for partner integration",
                    "Development and maintenance of SDK integration demo apps in Flutter, Xamarin, React Native, Kotlin and Swift",
                    "DevOps: GitLab CI/CD, Docker, Proxmox, Terraform — CI/CD setup, containerization, infrastructure management, deployment automation",
                    "Observability: integration of Sentry across all applications (mobile, desktop, backend, SDKs) for error tracking, performance monitoring and crash reporting",
                    "Mentored apprentices as training supervisor",
                    "Presentations at IUT de Vannes: career path sharing and student mentoring",
                ],
                fr: [
                    "Application de signature de PDF : développement d'applications mobiles Android (Kotlin) et iOS (Swift), puis Flutter (Dart), permettant la signature de documents PDF via un tampon connecté en Bluetooth",
                    "Application de signature de PDF : développement d'applications desktop Windows, macOS et Linux avec React et Electron",
                    "Gestion de l'objet connecté : développement des parcours d'onboarding, d'appairage Bluetooth, de mise à jour firmware (OTA) et de configuration du tampon connecté sur mobile et desktop",
                    "Développement et maintenance du backend (web-services) en Java/Kotlin avec Spring Boot, puis migration vers Rust : gestion des comptes, des documents et des signatures",
                    "Développement de middleware en Rust et C pour la communication bas niveau avec le tampon connecté",
                    "Développement, documentation et livraison continue de bibliothèques (SDK) en Swift, Kotlin, Rust, JavaScript, TypeScript et C pour l'intégration du tampon connecté par des partenaires",
                    "Développement et maintenance d'applications de démonstration d'intégration du SDK en Flutter, Xamarin, React Native, Kotlin et Swift",
                    "DevOps : mise en place de CI/CD (GitLab CI/CD), conteneurisation avec Docker, gestion d'infrastructure avec Proxmox et Terraform, automatisation des déploiements et livraisons",
                    "Observabilité : intégration de Sentry sur l'ensemble des applications (mobile, desktop, backend, SDK) pour le suivi des erreurs, la surveillance des performances et le reporting des crashes",
                    "Encadrement d'alternants en tant que maître d'apprentissage",
                    "Interventions à l'IUT de Vannes : présentation de parcours et accompagnement d'étudiants",
                ],
            },
        },
        {
            role: {
                en: "Intern",
                fr: "Stage de fin d'études",
            },
            company: { en: "BYSTAMP", fr: "BYSTAMP" },
            startDate: "2017-01",
            endDate: "2017-07",
            period: {
                en: "Jan 2017 — Jul 2017",
                fr: "Janvier 2017 - Juillet 2017",
            },
            description: {
                en: [
                    "Android mobile app development in Java/Kotlin and iOS in Objective-C/Swift",
                    "Maintenance and improvement of Java Spring Boot web-services",
                    "Maintenance and improvement of Angular websites",
                    "Business Intelligence and CRM implementation",
                ],
                fr: [
                    "Développement d'applications mobiles Android en Java/Kotlin et iOS en Objective-C/Swift",
                    "Maintenance et amélioration de web-services en Java Spring Boot",
                    "Maintenance et amélioration de sites web en Angular",
                    "Mise en place d'outils de Business Intelligence et d'une CRM",
                ],
            },
        },
        {
            role: { en: "Intern", fr: "Stage" },
            company: { en: "IUT de Vannes", fr: "IUT de Vannes" },
            startDate: "2014-03",
            endDate: "2014-06",
            period: {
                en: "Mar 2014 — Jun 2014",
                fr: "Mars 2014 - Juin 2014",
            },
            description: {
                en: [
                    "Maintenance and evolution of a native Android app presenting the IUT for open days and trade fairs",
                    "PHP backend development",
                ],
                fr: [
                    "Maintenance et évolution d'une application Android native de présentation de l'IUT pour les salons et portes ouvertes",
                    "Backend en PHP",
                ],
            },
        },
    ],

    education: [
        {
            degree: {
                en: "Master in Multimedia, Web, Networks",
                fr: "Master Multimédia, Web, Réseaux",
            },
            school: "Université de Bretagne Sud",
            startYear: "2015",
            endYear: "2017",
        },
        {
            degree: {
                en: "License in Mathematics, IT, Statistics",
                fr: "Licence Mathématiques, Informatique, Statistiques",
            },
            school: "Université de Bretagne Sud",
            startYear: "2014",
            endYear: "2015",
        },
        {
            degree: {
                en: "DUT in Computer Science",
                fr: "DUT Informatique",
            },
            school: "IUT de Vannes",
            startYear: "2012",
            endYear: "2014",
        },
    ],

    languages: [
        {
            name: { en: "French", fr: "Français" },
            level: { en: "Native", fr: "Langue maternelle" },
            code: "fr",
        },
        {
            name: { en: "English", fr: "Anglais" },
            level: { en: "Fluent", fr: "Fluent" },
            code: "en",
        },
        {
            name: { en: "German", fr: "Allemand" },
            level: { en: "Basic", fr: "Notions" },
            code: "de",
        },
    ],

    interests: [
        { label: { en: "Homelab", fr: "Homelab" }, emoji: "🖥️" },
        { label: { en: "Coffee", fr: "Café" }, emoji: "☕" },
        { label: { en: "Cycling", fr: "Vélo" }, emoji: "🚴" },
        { label: { en: "Rock climbing", fr: "Escalade" }, emoji: "🧗" },
    ],

    // UI translations (website-specific labels)
    ui: {
        en: {
            cta: "Get in Touch",
            resume_link: "Resume",
            about_title: "About",
            skills_title: "Skills",
            exp_title: "Experience",
            edu_title: "Education",
            lang_title: "Languages",
            interests_title: "Interests",
            contact_title: "Let's Connect",
            contact_text:
                "Interested in working together or just want to say hello?",
            footer: "© 2026 Simon Brunou — Built with care in Brittany",
            skip_link: "Skip to main content",
            theme_toggle: "Toggle theme",
        },
        fr: {
            cta: "Me Contacter",
            resume_link: "CV",
            about_title: "À propos",
            skills_title: "Compétences",
            exp_title: "Expérience",
            edu_title: "Formation",
            lang_title: "Langues",
            interests_title: "Centres d'intérêt",
            contact_title: "Restons en contact",
            contact_text:
                "Intéressé par une collaboration ou simplement envie de dire bonjour ?",
            footer: "© 2026 Simon Brunou — Fait avec soin en Bretagne",
            skip_link: "Aller au contenu principal",
            theme_toggle: "Changer de thème",
        },
    },
};
