// Shared rendering helpers for index.html and pdf-template/index.html.
// Loaded after data.js. Exposes window.SBRender.
//
// The pages render different DOM, so this module covers the concerns that
// benefit from one source of truth: language picking and the canonical
// Person JSON-LD.
(function () {
    function pickLang(value, lang) {
        if (
            value &&
            typeof value === "object" &&
            ("en" in value || "fr" in value)
        ) {
            return value[lang] || value.en;
        }
        return value;
    }

    function dedupeBySchool(education) {
        var seen = {};
        return education.filter(function (e) {
            if (seen[e.school]) return false;
            seen[e.school] = true;
            return true;
        });
    }

    function buildPersonJsonLd(D, lang) {
        var P = D.personal;
        var allSkills = D.skills.languages.concat(
            D.skills.frameworks,
            D.skills.tools,
        );
        return {
            "@context": "https://schema.org",
            "@type": "Person",
            name: P.name,
            givenName: P.firstName,
            familyName: P.lastName,
            url: P.websiteUrl,
            email: P.email,
            telephone: P.phone,
            jobTitle: pickLang(D.title, lang),
            address: {
                "@type": "PostalAddress",
                addressLocality: "Saint-Nolff",
                addressRegion: lang === "fr" ? "Bretagne" : "Brittany",
                addressCountry: "FR",
            },
            knowsLanguage: D.languages.map(function (l) {
                return {
                    "@type": "Language",
                    name: pickLang(l.name, lang),
                    alternateName: l.code,
                };
            }),
            knowsAbout: allSkills.concat([
                "Mobile Development",
                "Fullstack Development",
                "DevOps",
            ]),
            hasOccupation: D.experience.reduce(function (roles, exp) {
                return roles.concat(
                    exp.positions.map(function (pos) {
                        return {
                            "@type": "Role",
                            roleName: pickLang(pos.role, lang),
                            startDate: pos.startDate,
                            endDate: pos.endDate,
                            description: pickLang(pos.description, lang).join(". "),
                            worksFor: {
                                "@type": "Organization",
                                name: pickLang(exp.company, lang),
                            },
                        };
                    }),
                );
            }, []),
            alumniOf: dedupeBySchool(D.education).map(function (e) {
                return { "@type": "EducationalOrganization", name: e.school };
            }),
            hasCredential: D.education.map(function (e) {
                return {
                    "@type": "EducationalOccupationalCredential",
                    credentialCategory: "degree",
                    name: pickLang(e.degree, lang),
                    recognizedBy: {
                        "@type": "EducationalOrganization",
                        name: e.school,
                    },
                    dateCreated: e.endYear,
                };
            }),
            sameAs: [P.githubUrl, P.linkedinUrl],
        };
    }

    function injectJsonLd(D, lang) {
        var ldScript = document.createElement("script");
        ldScript.type = "application/ld+json";
        ldScript.textContent = JSON.stringify(buildPersonJsonLd(D, lang));
        document.head.appendChild(ldScript);
    }

    window.SBRender = {
        pickLang: pickLang,
        buildPersonJsonLd: buildPersonJsonLd,
        injectJsonLd: injectJsonLd,
    };
})();
