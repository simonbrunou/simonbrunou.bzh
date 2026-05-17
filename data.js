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
        fr: "Développeur Fullstack investi et rigoureux, fort d'une expérience en développement d'applications mobiles, en gestion de projet, en relation client et en livraison continue. Basé en Bretagne, je conçois des applications robustes sur toute la stack — du mobile au backend, en passant par le desktop et le middleware — avec une passion pour Rust et la programmation système.",
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
                fr: "Février 2025 — Juillet 2025",
            },
            description: {
                en: [
                    "Built mobile companion POC application in Dart and Flutter: interaction with connected device, user account management, and web services consumption",
                    "Developed Rust libraries for low-level communication with a connected device",
                ],
                fr: [
                    "Développement d'une application mobile compagnon (POC) en Dart et Flutter : interaction avec un objet connecté, gestion de compte utilisateur et consommation d'API",
                    "Développement de bibliothèques en Rust pour la communication de bas niveau avec un objet connecté",
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
                fr: "Juillet 2017 — Février 2025",
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
                    "Gestion de l'objet connecté : développement des parcours d'onboarding, d'appairage Bluetooth, de mises à jour firmware (OTA) et de configuration du tampon connecté sur mobile et desktop",
                    "Développement et maintenance du backend (web services) en Java/Kotlin avec Spring Boot, puis migration vers Rust : gestion des comptes, des documents et des signatures",
                    "Développement de middleware en Rust et C pour la communication de bas niveau avec le tampon connecté",
                    "Développement, documentation et livraison continue de bibliothèques (SDK) en Swift, Kotlin, Rust, JavaScript, TypeScript et C destinées à l'intégration du tampon connecté par des partenaires tiers",
                    "Développement et maintenance d'applications de démonstration d'intégration du SDK en Flutter, Xamarin, React Native, Kotlin et Swift",
                    "DevOps : mise en place de CI/CD (GitLab CI/CD), conteneurisation avec Docker, gestion d'infrastructure avec Proxmox et Terraform, automatisation des déploiements et livraisons",
                    "Observabilité : intégration de Sentry sur l'ensemble des applications (mobile, desktop, backend, SDK) pour le suivi des erreurs et des performances et le signalement des plantages",
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
                fr: "Janvier 2017 — Juillet 2017",
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
                    "Maintenance et amélioration de web services en Java Spring Boot",
                    "Maintenance et amélioration de sites web en Angular",
                    "Mise en place d'outils de Business Intelligence et d'un CRM",
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
                fr: "Mars 2014 — Juin 2014",
            },
            description: {
                en: [
                    "Maintenance and evolution of a native Android app presenting the IUT for open days and trade fairs",
                    "PHP backend development",
                ],
                fr: [
                    "Maintenance et évolution d'une application Android native de présentation de l'IUT pour les salons et journées portes ouvertes",
                    "Backend en PHP",
                ],
            },
        },
    ],

    projects: [
        {
            name: "Diversif",
            url: "https://diversif.app",
            repoUrl: "https://github.com/simonbrunou/diversif",
            period: { en: "2026 — present", fr: "2026 — présent" },
            tagline: {
                en: "Baby food diversification tracker with co-parent sharing",
                fr: "Suivi de la diversification alimentaire d'un bébé, avec partage entre parents",
            },
            description: {
                en: [
                    "Bilingual (FR/EN) PWA: log a baby's food introductions in a few taps, share the journal with a co-parent, follow priority allergens",
                    "Evidence-based content from HCSP, LEAP and EAT guidelines, with cited sources and a privacy-first, no-telemetry stance",
                    "Solo full-stack build (SvelteKit, Postgres, Sentry), self-hostable in a single Docker container, RGPD-compliant (export, deletion, retention)",
                ],
                fr: [
                    "PWA bilingue (FR/EN) : journal de la diversification alimentaire en quelques gestes, partage avec un co-parent, suivi des allergènes prioritaires",
                    "Contenu fondé sur les recommandations HCSP, LEAP et EAT, sources citées, approche privacy-first sans télémétrie",
                    "Stack complète développée en solo (SvelteKit, Postgres, Sentry), auto-hébergeable en un seul conteneur Docker, conforme RGPD (export, suppression, rétention)",
                ],
            },
            stack: [
                "SvelteKit",
                "Svelte 5",
                "TypeScript",
                "Postgres",
                "Drizzle",
                "Tailwind",
                "Docker",
            ],
        },
        {
            name: "Tisanerie",
            url: "https://tisanerie.app",
            repoUrl: "https://github.com/simonbrunou/tisanerie",
            period: { en: "2026", fr: "2026" },
            tagline: {
                en: "Herbal infusion recommender by need — sleep, focus, digestion…",
                fr: "Recommandation de tisanes selon le besoin — sommeil, concentration, digestion…",
            },
            description: {
                en: [
                    "Bilingual (FR/EN) recommender: surfaces herbal infusions matching what the user needs (sleep, focus, digestion…) via a scoring engine",
                    "Content-as-data architecture: ~25 plants and ~12 needs as Zod-validated JSON, both languages generated at build time",
                    "Astro 5 with minimal React islands, deployed on Cloudflare Pages, no telemetry by default",
                ],
                fr: [
                    "Recommandation bilingue (FR/EN) : propose les tisanes adaptées au besoin (sommeil, concentration, digestion…) via un moteur de scoring",
                    "Architecture content-as-data : ~25 plantes et ~12 besoins en JSON validé par Zod, génération des deux langues au build",
                    "Astro 5 avec des îlots React minimalistes, déployé sur Cloudflare Pages, sans télémétrie par défaut",
                ],
            },
            stack: [
                "Astro",
                "React",
                "TypeScript",
                "Tailwind",
                "Zod",
                "Cloudflare Pages",
            ],
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
            level: { en: "Fluent", fr: "Courant" },
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
            projects_title: "Open Source",
            edu_title: "Education",
            lang_title: "Languages",
            interests_title: "Interests",
            contact_title: "Let's Connect",
            contact_text:
                "Interested in working together or just want to say hello?",
            footer: "© 2026 Simon Brunou — Built with care in Brittany",
            skip_link: "Skip to main content",
            theme_toggle: "Toggle theme",
            back_to_top: "Back to top",
            section_heading_about: "Building end-to-end, from connected device to backend.",
            section_heading_skills: "What I work with",
            section_heading_exp: "Selected work",
            section_heading_projects: "Built and shipped in the open",
            section_heading_edu: "Studied at",
            section_heading_lang: "Spoken tongues",
            section_heading_interests: "Off-keyboard",
            section_heading_contact: "Let's connect",
            projects_visit: "Visit",
            projects_source: "Source",
        },
        fr: {
            cta: "Me Contacter",
            resume_link: "CV",
            about_title: "À propos",
            skills_title: "Compétences",
            exp_title: "Expérience",
            projects_title: "Open Source",
            edu_title: "Formation",
            lang_title: "Langues",
            interests_title: "Centres d'intérêt",
            contact_title: "Restons en contact",
            contact_text:
                "Intéressé par une collaboration ou simplement envie de dire bonjour ?",
            footer: "© 2026 Simon Brunou — Fait avec soin en Bretagne",
            skip_link: "Aller au contenu principal",
            theme_toggle: "Changer de thème",
            back_to_top: "Haut de page",
            section_heading_about: "Construire de bout en bout, de l'objet connecté au backend.",
            section_heading_skills: "Mes outils du quotidien",
            section_heading_exp: "Sélection de réalisations",
            section_heading_projects: "Mes projets en open source",
            section_heading_edu: "Parcours académique",
            section_heading_lang: "Langues parlées",
            section_heading_interests: "Hors-clavier",
            section_heading_contact: "Restons en contact",
            projects_visit: "Visiter",
            projects_source: "Code source",
        },
    },
};
