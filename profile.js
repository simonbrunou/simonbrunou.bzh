// The Profile: the content of data.js plus every rule derived from it.
// The homepage (app.js), the CV (pdf-template/app.js) and the tests in Node
// all ask this module instead of working the rules out again.
//
// An ES module so the browser and Node load the same file. It must not
// touch window or document when imported: Node has neither.
import content from "./data.js";

const LANGS = ["en", "fr"];

const MONTHS = {
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    fr: [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ],
};

// A { en, fr } value in the given language, English when that language is
// missing. Anything else comes back as is.
export function pick(value, lang) {
    if (value && typeof value === "object" && ("en" in value || "fr" in value)) {
        return value[lang] || value.en;
    }
    return value;
}

// The language the Visitor gets on arrival. ?lang= (hreflang arrivals,
// shared links) wins over the stored choice, which wins over English.
// Takes the browser's window, or any object with the same two fields.
export function visitorLang(win) {
    const fromUrl = new URLSearchParams(win.location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "fr") return fromUrl;
    try {
        if (win.localStorage.getItem("lang") === "fr") return "fr";
    } catch (_) {}
    return "en";
}

// A Featured project is one with screenshots (GLOSSARY.md).
function isFeatured(project) {
    return Boolean(project.shots && project.shots.length);
}

// A job runs from its first position's start to its last one's end
// (positions run oldest first).
function jobDates(job) {
    return [job.positions[0].startDate, job.positions[job.positions.length - 1].endDate];
}

// Months the job lasted.
function tenure(job) {
    const [start, end] = jobDates(job).map((date) => date.split("-"));
    return (end[0] - start[0]) * 12 + (end[1] - start[1]);
}

// "2017–2025", or "2025" when the job started and ended the same year.
function employerYears(job) {
    const [from, to] = jobDates(job).map((date) => date.slice(0, 4));
    return from === to ? from : from + "–" + to;
}

function monthYear(date, lang) {
    const [year, month] = date.split("-");
    return pick(MONTHS, lang)[month - 1] + " " + year;
}

// "Feb 2025 – Jul 2025" in English, "Février 2025 – Juillet 2025" in French.
function period(position, lang) {
    return monthYear(position.startDate, lang) + " – " + monthYear(position.endDate, lang);
}

// Checks the shape of data and returns the Profile. Throws on the first
// field a renderer needs and data lacks, naming its owner:
// "data.js: projects[cinder].stack is missing".
export function createProfile(data) {
    checkShape(data);

    // The Main job: the longest-held one; the first one listed wins a tie.
    const mainJob = data.experience.reduce((main, job) => (tenure(job) > tenure(main) ? job : main));

    // "Saint-Nolff, Brittany, France".
    function location(lang) {
        const address = data.personal.address;
        return [address.locality, pick(address.region, lang), pick(address.country.name, lang)].join(", ");
    }

    // One group per key of data.skills, in data order, with its label.
    const skillGroups = Object.keys(data.skills).map((key) => ({
        key,
        label: data.skillCategoryLabels[key],
        skills: data.skills[key],
    }));

    // The schema.org Person block the homepage puts in its <head>.
    function personJsonLd(lang) {
        const P = data.personal;
        return {
            "@context": "https://schema.org",
            "@type": "Person",
            name: P.name,
            givenName: P.firstName,
            familyName: P.lastName,
            url: P.websiteUrl,
            email: P.email,
            telephone: P.phone,
            jobTitle: pick(data.title, lang),
            address: {
                "@type": "PostalAddress",
                addressLocality: P.address.locality,
                addressRegion: pick(P.address.region, lang),
                addressCountry: P.address.country.code,
            },
            knowsLanguage: data.languages.map((l) => ({
                "@type": "Language",
                name: pick(l.name, lang),
                alternateName: l.code,
            })),
            knowsAbout: skillGroups.flatMap((g) => g.skills).concat(data.knowsAbout),
            hasOccupation: data.experience.flatMap((job) =>
                job.positions.map((pos) => ({
                    "@type": "Role",
                    roleName: pick(pos.role, lang),
                    startDate: pos.startDate,
                    endDate: pos.endDate,
                    description: pick(pos.description, lang).join(". "),
                    worksFor: {
                        "@type": "Organization",
                        name: pick(job.company, lang),
                    },
                })),
            ),
            alumniOf: [...new Set(data.education.map((e) => e.school))].map((school) => ({
                "@type": "EducationalOrganization",
                name: school,
            })),
            hasCredential: data.education.map((e) => ({
                "@type": "EducationalOccupationalCredential",
                credentialCategory: "degree",
                name: pick(e.degree, lang),
                recognizedBy: {
                    "@type": "EducationalOrganization",
                    name: e.school,
                },
                dateCreated: e.endYear,
            })),
            sameAs: [P.githubUrl, P.linkedinUrl],
        };
    }

    return {
        data,
        isFeatured,
        mainJob,
        employerYears,
        period,
        location,
        skillGroups,
        personJsonLd,
    };
}

function checkShape(data) {
    function fail(path, problem) {
        throw new Error(`data.js: ${path} ${problem}`);
    }
    function expect(value, path, kind, ok) {
        if (value === undefined || value === null || value === "") fail(path, "is missing");
        if (!ok(value)) fail(path, `must be ${kind}`);
        return value;
    }
    const isObject = (v) => typeof v === "object" && !Array.isArray(v);
    const object = (v, path) => expect(v, path, "an object", isObject);
    const str = (v, path) => expect(v, path, "a string", (x) => typeof x === "string");
    const num = (v, path) => expect(v, path, "a number", (x) => Number.isFinite(x));
    const year = (v, path) => expect(v, path, 'a year like "2017"', (x) => /^\d{4}$/.test(x));
    const month = (v, path) =>
        expect(v, path, 'a month like "2017-07"', (x) => /^\d{4}-(0[1-9]|1[0-2])$/.test(x));
    const list = (v, path) => expect(v, path, "a non-empty list", (x) => Array.isArray(x) && x.length > 0);
    const strings = (v, path) => list(v, path).forEach((s, i) => str(s, `${path}[${i}]`));
    // A non-empty list of objects.
    const entries = (v, path) => {
        list(v, path).forEach((item, i) => object(item, `${path}[${i}]`));
        return v;
    };
    // { en, fr } with a string, or a list of strings, in each language.
    const bilingual = (v, path) => expect(v, path, "{ en, fr }", isObject);
    const text = (v, path) => LANGS.forEach((l) => str(bilingual(v, path)[l], `${path}.${l}`));
    const lines = (v, path) => LANGS.forEach((l) => strings(bilingual(v, path)[l], `${path}.${l}`));

    const P = object(data.personal, "personal");
    ["name", "firstName", "lastName", "email", "phone", "githubUrl", "githubDisplay",
        "linkedinUrl", "linkedinDisplay", "websiteUrl"].forEach((key) => str(P[key], `personal.${key}`));
    text(P.phoneDisplay, "personal.phoneDisplay");
    const address = object(P.address, "personal.address");
    str(address.locality, "personal.address.locality");
    text(address.region, "personal.address.region");
    str(object(address.country, "personal.address.country").code, "personal.address.country.code");
    text(address.country.name, "personal.address.country.name");

    text(data.title, "title");
    lines(data.about, "about");

    entries(data.projects, "projects").forEach((p, i) => {
        const at = `projects[${p.id || i}]`;
        ["id", "name", "repoUrl"].forEach((key) => str(p[key], `${at}.${key}`));
        if (p.url !== undefined) str(p.url, `${at}.url`);
        year(p.year, `${at}.year`);
        text(p.summary, `${at}.summary`);
        strings(p.stack, `${at}.stack`);
        if (p.shots === undefined) return;
        expect(p.shots, `${at}.shots`, "a list", Array.isArray);
        if (p.shots.length) text(p.details, `${at}.details`);
        p.shots.forEach((shot, j) => {
            const s = `${at}.shots[${j}]`;
            object(shot, s);
            str(shot.src, `${s}.src`);
            num(shot.width, `${s}.width`);
            num(shot.height, `${s}.height`);
            text(shot.alt, `${s}.alt`);
            num(object(shot.crop, `${s}.crop`).wide, `${s}.crop.wide`);
            const narrow = object(shot.crop.narrow, `${s}.crop.narrow`);
            ["ratio", "x", "y", "w"].forEach((key) => num(narrow[key], `${s}.crop.narrow.${key}`));
        });
    });

    entries(data.experience, "experience").forEach((job, i) => {
        const at = `experience[${(job.company && job.company.en) || i}]`;
        text(job.company, `${at}.company`);
        text(job.summary, `${at}.summary`);
        entries(job.positions, `${at}.positions`).forEach((pos, j) => {
            const p = `${at}.positions[${j}]`;
            text(pos.role, `${p}.role`);
            month(pos.startDate, `${p}.startDate`);
            month(pos.endDate, `${p}.endDate`);
            if (pos.endDate < pos.startDate) fail(p, "ends before it starts");
            lines(pos.description, `${p}.description`);
        });
        // The Main job and the employer years read the first and last position.
        if (job.positions.some((pos, j) => j > 0 && pos.startDate < job.positions[j - 1].startDate)) {
            fail(`${at}.positions`, "must run oldest first");
        }
    });

    Object.keys(object(data.skills, "skills")).forEach((key) => {
        strings(data.skills[key], `skills.${key}`);
        text((data.skillCategoryLabels || {})[key], `skillCategoryLabels.${key}`);
    });
    strings(data.knowsAbout, "knowsAbout");

    entries(data.education, "education").forEach((e, i) => {
        const at = `education[${i}]`;
        text(e.degree, `${at}.degree`);
        str(e.school, `${at}.school`);
        year(e.startYear, `${at}.startYear`);
        year(e.endYear, `${at}.endYear`);
    });

    entries(data.languages, "languages").forEach((l, i) => {
        const at = `languages[${l.code || i}]`;
        str(l.code, `${at}.code`);
        text(l.name, `${at}.name`);
        text(l.level, `${at}.level`);
    });

    list(data.interests, "interests").forEach((interest, i) => text(interest, `interests[${i}]`));

    // Every homepage label exists in both languages.
    const ui = object(data.ui, "ui");
    LANGS.forEach((l) => object(ui[l], `ui.${l}`));
    const keys = new Set(LANGS.flatMap((l) => Object.keys(ui[l])));
    keys.forEach((key) => LANGS.forEach((l) => str(ui[l][key], `ui.${l}.${key}`)));
}

export default createProfile(content);
