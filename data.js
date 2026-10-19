// Shared data for simonbrunou.bzh and the CV.
// Edit this file to update both the website and the CV PDF.
// profile.js reads it and derives the rest (see AGENTS.md).
export default {
    personal: {
        name: "Simon Brunou",
        firstName: "Simon",
        lastName: "Brunou",
        email: "simon.brunou@proton.me",
        phone: "+33621041865",
        phoneDisplay: { en: "+33 621 041 865", fr: "06 21 04 18 65" },
        // Shown as "Saint-Nolff, Brittany, France", and given to search
        // engines as the postal address in the JSON-LD.
        address: {
            locality: "Saint-Nolff",
            region: { en: "Brittany", fr: "Bretagne" },
            country: { code: "FR", name: { en: "France", fr: "France" } },
        },
        githubUrl: "https://github.com/simonbrunou",
        githubDisplay: "github.com/simonbrunou",
        linkedinUrl: "https://www.linkedin.com/in/simon-brunou-a7a5a489",
        linkedinDisplay: "linkedin.com/in/simon-brunou",
        websiteUrl: "https://simonbrunou.bzh",
    },

    title: {
        en: "Fullstack developer",
        fr: "Développeur fullstack",
    },

    // One paragraph per entry.
    about: {
        en: [
            "I'm Simon. For eight years at BYSTAMP I worked on every layer of the software around a connected signing stamp: the Android, iOS and Flutter apps, the desktop app, Bluetooth pairing and firmware updates, the Spring Boot backend we later rewrote in Rust, and SDKs in six languages.",
            "This year I shipped three products of my own. I live in Saint-Nolff, near Vannes, and spend the rest of my time cycling, climbing, making coffee and running a homelab.",
        ],
        fr: [
            "Je suis Simon. Pendant huit ans chez BYSTAMP, j'ai travaillé sur toutes les couches du logiciel d'un tampon de signature connecté\u00a0: les applications Android, iOS et Flutter, l'application desktop, l'appairage Bluetooth et les mises à jour firmware, le backend Spring Boot que nous avons ensuite réécrit en Rust, et des SDK dans six langages.",
            "Cette année, j'ai sorti trois produits personnels. J'habite à Saint-Nolff, près de Vannes. Le reste du temps, je fais du vélo, de l'escalade, du café, et je m'occupe de mon homelab.",
        ],
    },

    // Products Simon built and shipped himself, newest first. A project with
    // screenshots gets a full-width band on the homepage, in its palette and
    // on the other side from the band above it; the others get one line
    // under the bands.
    projects: [
        {
            id: "diversif",
            name: "Diversif",
            year: "2026",
            url: "https://diversif.app",
            repoUrl: "https://github.com/simonbrunou/diversif",
            summary: {
                en: "A weaning notebook for parents. Log each new food, follow the 12 priority allergens, and share the notebook with your co-parent.",
                fr: "Un carnet de diversification alimentaire pour les parents. On note chaque nouvel aliment, on suit les 12 allergènes prioritaires et on partage le carnet avec l'autre parent.",
            },
            details: {
                en: "SvelteKit and Postgres. In-house sign-in with passkeys, an offline queue so entries survive a dead signal, and guidance sourced from HCSP, LEAP and EAT. No ads, no analytics. Self-hosted as a single Docker image. The interface is in French.",
                fr: "SvelteKit et Postgres. Authentification maison avec passkeys, file d'attente hors ligne pour ne rien perdre sans réseau, contenu sourcé (HCSP, LEAP, EAT). Ni publicité ni mesure d'audience. Auto-hébergé en une seule image Docker.",
            },
            stack: ["SvelteKit", "TypeScript", "Postgres", "Drizzle", "Docker"],
            // The Band palette, taken from the app itself. The homepage Band
            // and the CV strip both use it.
            palette: {
                ground: "#ffdbbd", // Band and strip background
                text: "#4a2108", // running text
                soft: "#692d07", // year, details, stack
                accent: "#2f4a33", // name, focus ring, selection
                field: "#6b8e6b", // flat field behind the screenshots
                shadow: "rgba(38, 24, 10, 0.5)", // under the screenshots
            },
            // crop.wide: aspect ratio of the visible window on wide screens
            // (the image is cut at the bottom). crop.narrow: the window shown
            // on narrow screens, as an aspect ratio plus its left, top and
            // width as fractions of the image.
            shots: [
                {
                    src: "/images/diversif-home.webp",
                    width: 1440,
                    height: 900,
                    alt: {
                        en: "Diversif home page: \"Diversifier en confiance, à votre rythme\" with a create-account button",
                        fr: "Page d'accueil de Diversif\u00a0: «\u00a0Diversifier en confiance, à votre rythme\u00a0» et le bouton de création de compte",
                    },
                    crop: { wide: 1440 / 790, narrow: { ratio: 792 / 500, x: 0.2, y: 0.07, w: 0.55 } },
                },
                {
                    src: "/images/diversif-allergens.webp",
                    width: 1440,
                    height: 900,
                    alt: {
                        en: "Diversif allergens page listing the 12 tracked allergens with the age to introduce each",
                        fr: "Page des allergènes de Diversif\u00a0: les 12 allergènes suivis et l'âge d'introduction de chacun",
                    },
                    crop: { wide: 1440 / 900, narrow: { ratio: 864 / 520, x: 0.2, y: 0.07, w: 0.6 } },
                },
            ],
        },
        {
            id: "cinder",
            name: "Cinder",
            year: "2026",
            repoUrl: "https://github.com/simonbrunou/cinder",
            summary: {
                en: "A request desk for a household's media library. Someone asks for a film, a series or a book, an admin approves, and it shows up in Jellyfin or Plex. It runs my own household's library.",
                fr: "Un guichet de demandes pour la médiathèque d'un foyer. Quelqu'un demande un film, une série ou un livre, l'admin valide, et le titre arrive dans Jellyfin ou Plex. C'est lui qui gère la médiathèque de la maison.",
            },
            details: {
                en: "Phoenix LiveView on SQLite, in one container. Each request moves through a state machine driven by background workers, with live updates over PubSub. Every outside service sits behind its own adapter, and the setup wizard checks each one before first use. Replaces Sonarr, Radarr, Seerr and Readarr. Over 1,100 commits since June 2026, now at v3.0, GPLv3.",
                fr: "Phoenix LiveView sur SQLite, dans un seul conteneur. Chaque demande avance dans une machine à états pilotée par des workers en arrière-plan, avec mise à jour en direct via PubSub. Chaque service externe passe par son propre adaptateur, et l'assistant d'installation les vérifie tous avant le premier usage. Remplace Sonarr, Radarr, Seerr et Readarr. Plus de 1\u00a0100 commits depuis juin 2026, version 3.0, sous GPLv3.",
            },
            stack: ["Elixir", "Phoenix LiveView", "SQLite", "Tailwind", "Docker"],
            palette: {
                ground: "#0b0c10",
                text: "#ece8e3",
                soft: "#b9b6b2",
                accent: "#f38042",
                field: "#f38042",
                shadow: "rgba(30, 10, 0, 0.7)",
            },
            shots: [
                {
                    src: "/images/cinder-library.webp",
                    width: 1920,
                    height: 1200,
                    alt: {
                        en: "Cinder library page on the series tab: posters of the monitored shows, a title filter and a sort menu",
                        fr: "Page bibliothèque de Cinder, onglet séries\u00a0: affiches des séries suivies, filtre par titre et tri",
                    },
                    crop: { wide: 1920 / 1200, narrow: { ratio: 893 / 600, x: 0.19, y: 0.02, w: 0.62 } },
                },
                {
                    src: "/images/cinder-dashboard.webp",
                    width: 1920,
                    height: 1671,
                    alt: {
                        en: "Cinder admin dashboard: library counts, maintenance jobs, and fourteen connected services all reporting OK",
                        fr: "Tableau de bord admin de Cinder\u00a0: compteurs de la médiathèque, tâches de maintenance et quatorze services connectés, tous OK",
                    },
                    crop: { wide: 1920 / 1200, narrow: { ratio: 570 / 450, x: 0.59, y: 0.44, w: 0.4 } },
                },
            ],
        },
        {
            id: "tisanerie",
            name: "Tisanerie",
            year: "2026",
            url: "https://tisanerie.app",
            repoUrl: "https://github.com/simonbrunou/tisanerie",
            summary: {
                en: "Suggests herbal teas by need: sleep, focus, digestion. Astro, about 60 plants.",
                fr: "Propose des tisanes selon le besoin\u00a0: sommeil, concentration, digestion. Astro, une soixantaine de plantes.",
            },
            stack: ["Astro", "React", "TypeScript", "Tailwind", "Zod", "Docker"],
        },
    ],

    // Newest first. Each entry is one employer; its positions run oldest
    // first, so a promotion reads top to bottom.
    experience: [
        {
            company: {
                en: "Confidential Startup",
                fr: "Startup (confidentiel)",
            },
            summary: {
                en: "Built a Flutter companion app and Rust libraries for a connected device, as a proof of concept.",
                fr: "Application compagnon en Flutter et bibliothèques Rust pour un objet connecté, en preuve de concept.",
            },
            positions: [
                {
                    role: { en: "Fullstack developer", fr: "Développeur fullstack" },
                    startDate: "2025-02",
                    endDate: "2025-07",
                    description: {
                        en: [
                            "Built mobile companion POC application in Dart and Flutter: interaction with connected device, user account management, and web services consumption",
                            "Developed Rust libraries for low-level communication with a connected device",
                        ],
                        fr: [
                            "Développement d'une application mobile compagnon (POC) en Dart et Flutter\u00a0: interaction avec un objet connecté, gestion de compte utilisateur et consommation d'API",
                            "Développement de bibliothèques en Rust pour la communication de bas niveau avec un objet connecté",
                        ],
                    },
                },
            ],
        },
        {
            company: { en: "BYSTAMP", fr: "BYSTAMP" },
            summary: {
                en: "Mobile apps in Kotlin and Swift, then Flutter. Desktop in React and Electron. Backend in Spring Boot, then Rust. Middleware in Rust and C, SDKs in six languages, CI/CD and Sentry across all of it. Trained apprentices.",
                fr: "Applications mobiles en Kotlin et Swift, puis Flutter. Desktop en React et Electron. Backend en Spring Boot, puis Rust. Middleware en Rust et C, SDK dans six langages, CI/CD et Sentry partout. Maître d'apprentissage.",
            },
            positions: [
                {
                    role: { en: "Intern", fr: "Stage de fin d'études" },
                    startDate: "2017-01",
                    endDate: "2017-07",
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
                    role: { en: "Fullstack developer", fr: "Développeur fullstack" },
                    startDate: "2017-07",
                    endDate: "2025-02",
                    description: {
                        en: [
                            "PDF signing app: Android (Kotlin) and iOS (Swift) mobile apps, then Flutter (Dart), for signing PDF documents via a Bluetooth-connected stamp",
                            "PDF signing app: desktop applications for Windows, macOS and Linux with React and Electron",
                            "Connected device management: onboarding flows, Bluetooth pairing, firmware updates (OTA) and stamp configuration on mobile and desktop",
                            "Development and maintenance of backend web-services in Java/Kotlin with Spring Boot, then migration to Rust: account, document and signature management",
                            "Middleware development in Rust and C for low-level communication with the connected stamp",
                            "Development, documentation and continuous delivery of SDKs in Swift, Kotlin, Rust, JavaScript, TypeScript and C for partner integration",
                            "Development and maintenance of SDK integration demo apps in Flutter, Xamarin, React Native, Kotlin and Swift",
                            "DevOps (GitLab CI/CD, Docker, Proxmox, Terraform): CI/CD setup, containerization, infrastructure management, deployment automation",
                            "Observability: integration of Sentry across all applications (mobile, desktop, backend, SDKs) for error tracking, performance monitoring and crash reporting",
                            "Mentored apprentices as training supervisor",
                            "Presentations at IUT de Vannes: career path sharing and student mentoring",
                        ],
                        fr: [
                            "Application de signature de PDF\u00a0: développement d'applications mobiles Android (Kotlin) et iOS (Swift), puis Flutter (Dart), permettant la signature de documents PDF via un tampon connecté en Bluetooth",
                            "Application de signature de PDF\u00a0: développement d'applications desktop Windows, macOS et Linux avec React et Electron",
                            "Gestion de l'objet connecté\u00a0: développement des parcours d'onboarding, d'appairage Bluetooth, de mises à jour firmware (OTA) et de configuration du tampon connecté sur mobile et desktop",
                            "Développement et maintenance du backend (web services) en Java/Kotlin avec Spring Boot, puis migration vers Rust\u00a0: gestion des comptes, des documents et des signatures",
                            "Développement de middleware en Rust et C pour la communication de bas niveau avec le tampon connecté",
                            "Développement, documentation et livraison continue de bibliothèques (SDK) en Swift, Kotlin, Rust, JavaScript, TypeScript et C destinées à l'intégration du tampon connecté par des partenaires tiers",
                            "Développement et maintenance d'applications de démonstration d'intégration du SDK en Flutter, Xamarin, React Native, Kotlin et Swift",
                            "DevOps\u00a0: mise en place de CI/CD (GitLab CI/CD), conteneurisation avec Docker, gestion d'infrastructure avec Proxmox et Terraform, automatisation des déploiements et livraisons",
                            "Observabilité\u00a0: intégration de Sentry sur l'ensemble des applications (mobile, desktop, backend, SDK) pour le suivi des erreurs et des performances et le signalement des plantages",
                            "Encadrement d'alternants en tant que maître d'apprentissage",
                            "Interventions à l'IUT de Vannes\u00a0: présentation de parcours et accompagnement d'étudiants",
                        ],
                    },
                },
            ],
        },
        {
            company: { en: "IUT de Vannes", fr: "IUT de Vannes" },
            summary: {
                en: "Android app for the school's open days, with a PHP backend.",
                fr: "Application Android pour les journées portes ouvertes de l'IUT, avec un backend PHP.",
            },
            positions: [
                {
                    role: { en: "Intern", fr: "Stage" },
                    startDate: "2014-03",
                    endDate: "2014-06",
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
        },
    ],

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

    // More subjects for search engines, listed after the skills in the
    // JSON-LD. Not shown on the page.
    knowsAbout: ["Mobile Development", "Fullstack Development", "DevOps"],

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
        { en: "Homelab", fr: "Homelab" },
        { en: "Coffee", fr: "Café" },
        { en: "Cycling", fr: "Vélo" },
        { en: "Rock climbing", fr: "Escalade" },
    ],

    // Homepage labels.
    ui: {
        en: {
            page_title: "Simon Brunou, fullstack developer",
            skip_link: "Skip to content",
            switch_to: "Français",
            lang_switched: "Page now in English",
            cta_email: "Email me",
            cta_cv: "Download the CV (PDF, in French)",
            visit: "Open",
            source: "Source",
            new_tab: "(opens in a new tab)",
            more_title: "Also",
            experience_title: "Experience",
            detail_label: "Full detail",
            facts_title: "Skills, education, languages",
            education_label: "Education",
            spoken_label: "Spoken languages",
            contact_title: "Contact",
            contact_text: "Email is the quickest way to reach me.",
            footer: "© 2026 Simon Brunou. Saint-Nolff, Brittany.",
        },
        fr: {
            page_title: "Simon Brunou, développeur fullstack",
            skip_link: "Aller au contenu",
            switch_to: "English",
            lang_switched: "Page affichée en français",
            cta_email: "M'écrire",
            cta_cv: "Télécharger le CV (PDF)",
            visit: "Ouvrir",
            source: "Code source",
            new_tab: "(s'ouvre dans un nouvel onglet)",
            more_title: "Et aussi",
            experience_title: "Parcours",
            detail_label: "Détail complet",
            facts_title: "Compétences, formation, langues",
            education_label: "Formation",
            spoken_label: "Langues parlées",
            contact_title: "Contact",
            contact_text: "Le plus simple pour me joindre, c'est l'e-mail.",
            footer: "© 2026 Simon Brunou. Saint-Nolff, Bretagne.",
        },
    },
};
