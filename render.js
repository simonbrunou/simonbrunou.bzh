// Shared rendering helpers for index.html and pdf-template/index.html.
// Loaded after data.js. Exposes window.SBRender.
//
// The two pages render different DOM (different visual designs), so this
// module covers the concerns that benefit from one source of truth:
// language picking, period parsing, and the canonical Person JSON-LD.

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

    // Split "Feb 2025 — Jul 2025" or "Feb 2025 - Jul 2025" into [start, end].
    // Tolerates either separator so a future data tweak can't silently break dates.
    function splitPeriod(periodStr) {
        if (!periodStr) return ["", ""];
        var parts = String(periodStr).split(/\s+[—-]\s+/);
        return [parts[0] || "", parts[1] || ""];
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
            hasOccupation: D.experience.map(function (exp) {
                return {
                    "@type": "Role",
                    roleName: pickLang(exp.role, lang),
                    startDate: exp.startDate,
                    endDate: exp.endDate,
                    description: pickLang(exp.description, lang).join(". "),
                    worksFor: {
                        "@type": "Organization",
                        name: pickLang(exp.company, lang),
                    },
                };
            }),
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
        splitPeriod: splitPeriod,
        buildPersonJsonLd: buildPersonJsonLd,
        injectJsonLd: injectJsonLd,
    };
})();
