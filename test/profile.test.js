import { test } from "node:test";
import assert from "node:assert/strict";
import profile, { createProfile, pick, visitorLang } from "../profile.js";

const data = profile.data;

// A copy of data.js to break on purpose.
function copy(edit) {
    const d = structuredClone(data);
    edit(d);
    return d;
}

function project(id) {
    return data.projects.find((p) => p.id === id);
}

test("data.js passes the shape check", () => {
    assert.doesNotThrow(() => createProfile(data));
});

test("a Featured project is one with screenshots", () => {
    assert.deepEqual(
        data.projects.filter(profile.isFeatured).map((p) => p.id),
        ["diversif", "cinder"],
    );
    const p = createProfile(copy(() => {}));
    assert.equal(p.isFeatured({ ...project("tisanerie"), details: project("cinder").details }), false);
    assert.equal(p.isFeatured({ ...project("tisanerie"), shots: [] }), false);
});

test("the main job is the longest-held one", () => {
    assert.equal(profile.mainJob.company.en, "BYSTAMP");
});

test("on a tie for the main job, the first one listed wins", () => {
    const tied = copy((d) => {
        // BYSTAMP runs from 2017-01 to 2025-02.
        d.experience[0].positions = [{ ...d.experience[0].positions[0], startDate: "2017-01", endDate: "2025-02" }];
    });
    assert.equal(createProfile(tied).mainJob.company.en, "Confidential Startup");
});

test("an employer's years collapse when they start and end in the same year", () => {
    assert.deepEqual(data.experience.map(profile.employerYears), ["2025", "2017–2025", "2014"]);
});

test("a position's period is derived from its dates, in both languages", () => {
    for (const job of data.experience) {
        for (const pos of job.positions) {
            for (const lang of ["en", "fr"]) {
                assert.equal(profile.period(pos, lang), pos.period[lang], `${pos.startDate} ${lang}`);
            }
        }
    }
});

test("skill groups follow data.skills, each with its label", () => {
    assert.deepEqual(
        profile.skillGroups.map((g) => [g.key, pick(g.label, "en"), g.skills[0]]),
        [
            ["languages", "Languages", "Rust"],
            ["frameworks", "Frameworks", "Flutter"],
            ["tools", "Tools & DevOps", "Git"],
        ],
    );
});

test("the location is built from the address", () => {
    assert.equal(profile.location("en"), "Saint-Nolff, Brittany, France");
    assert.equal(profile.location("fr"), "Saint-Nolff, Bretagne, France");
});

test("the Person JSON-LD takes its address from data.js", () => {
    for (const [lang, region] of [["en", "Brittany"], ["fr", "Bretagne"]]) {
        assert.deepEqual(profile.personJsonLd(lang).address, {
            "@type": "PostalAddress",
            addressLocality: "Saint-Nolff",
            addressRegion: region,
            addressCountry: "FR",
        });
    }
    const moved = copy((d) => {
        d.personal.address.locality = "Vannes";
    });
    assert.equal(createProfile(moved).personJsonLd("en").address.addressLocality, "Vannes");
});

test("the Person JSON-LD speaks the language asked for", () => {
    assert.equal(profile.personJsonLd("en").jobTitle, "Fullstack developer");
    assert.equal(profile.personJsonLd("fr").jobTitle, "Développeur fullstack");
    assert.deepEqual(profile.personJsonLd("en").alumniOf.map((s) => s.name), [
        "Université de Bretagne Sud",
        "IUT de Vannes",
    ]);
});

test("pick returns the language asked for, then English, then the value itself", () => {
    assert.equal(pick({ en: "Tools", fr: "Outils" }, "fr"), "Outils");
    assert.equal(pick({ en: "Tools" }, "fr"), "Tools");
    assert.equal(pick("BYSTAMP", "fr"), "BYSTAMP");
});

function browser(search, stored) {
    return {
        location: { search },
        localStorage: {
            getItem() {
                if (stored instanceof Error) throw stored;
                return stored;
            },
        },
    };
}

test("the Visitor's language: ?lang= first, then the stored choice, then English", () => {
    assert.equal(visitorLang(browser("?lang=fr", null)), "fr");
    assert.equal(visitorLang(browser("?lang=en", "fr")), "en");
    assert.equal(visitorLang(browser("", "fr")), "fr");
    assert.equal(visitorLang(browser("?lang=de", "fr")), "fr");
    assert.equal(visitorLang(browser("", null)), "en");
    assert.equal(visitorLang(browser("", new Error("storage blocked"))), "en");
});

test("the shape check names the missing field and its owner", () => {
    const cases = [
        [(d) => delete d.projects[1].stack, "data.js: projects[cinder].stack is missing"],
        [(d) => delete d.projects[0].details.fr, "data.js: projects[diversif].details.fr is missing"],
        [(d) => delete d.projects[1].shots[1].crop.narrow, "data.js: projects[cinder].shots[1].crop.narrow is missing"],
        [(d) => delete d.experience[1].positions[1].endDate, "data.js: experience[BYSTAMP].positions[1].endDate is missing"],
        [(d) => (d.experience[1].positions[0].startDate = "2017-7"), 'data.js: experience[BYSTAMP].positions[0].startDate must be a month like "2017-07"'],
        [(d) => delete d.personal.address.region, "data.js: personal.address.region is missing"],
        [(d) => delete d.skillCategoryLabels.tools, "data.js: skillCategoryLabels.tools is missing"],
        [(d) => delete d.ui.fr.cta_cv, "data.js: ui.fr.cta_cv is missing"],
        [(d) => (d.title = "Developer"), "data.js: title must be { en, fr }"],
    ];
    for (const [edit, message] of cases) {
        assert.throws(() => createProfile(copy(edit)), { message });
    }
});

test("a project without screenshots needs no details", () => {
    assert.doesNotThrow(() => createProfile(copy((d) => delete d.projects[2].details)));
    assert.doesNotThrow(() => createProfile(copy((d) => (d.projects[2].shots = []))));
});
