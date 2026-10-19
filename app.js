// Homepage renderer (Bands). Builds the whole page from the Profile
// (profile.js) into #page, and rebuilds it when the Visitor switches language.
// DOM is built with createElement and textContent only, never innerHTML.
import profile, { pick as pickLang, visitorLang } from "./profile.js";

(function () {
    "use strict";

    var D = profile.data;
    var root = document.getElementById("page");
    var announcer = document.getElementById("a11y-announcer");
    var lang = visitorLang(window);

    function pick(value) {
        return pickLang(value, lang);
    }

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    // External links open in a new tab and say so to screen readers.
    function link(href, text, cls, opts) {
        var a = el("a", cls, text);
        a.href = href;
        if (opts && opts.download) a.setAttribute("download", "");
        if (/^https?:/.test(href)) {
            a.target = "_blank";
            a.rel = opts && opts.me ? "me noopener" : "noopener";
            a.appendChild(el("span", "sr-only", " " + D.ui[lang].new_tab));
        }
        return a;
    }

    function hostOf(url) {
        return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }

    function setLang(next) {
        if (next === lang) return;
        lang = next;
        try {
            localStorage.setItem("lang", next);
        } catch (_) {}
        var url = new URL(window.location.href);
        if (next === "fr") url.searchParams.set("lang", "fr");
        else url.searchParams.delete("lang");
        history.replaceState(null, "", url.pathname + url.search + url.hash);
        render();
        // The toggle was rebuilt with the page; keep keyboard focus on it.
        var toggle = root.querySelector(".lang-toggle");
        if (toggle) toggle.focus();
        announcer.textContent = "";
        setTimeout(function () {
            announcer.textContent = D.ui[lang].lang_switched;
        }, 100);
    }

    function renderIntro() {
        var ui = D.ui[lang];
        var other = lang === "en" ? "fr" : "en";
        var sec = el("section", "intro");
        sec.setAttribute("aria-labelledby", "name");
        var wrap = el("div", "wrap intro-grid");

        var toggle = el("button", "lang-toggle", ui.switch_to);
        toggle.type = "button";
        toggle.setAttribute("lang", other);
        toggle.addEventListener("click", function () {
            setLang(other);
        });
        wrap.appendChild(toggle);

        var who = el("div", "who");
        var photo = el("img", "photo");
        photo.src = "/photo.png";
        photo.width = 76;
        photo.height = 76;
        photo.alt = "";
        who.appendChild(photo);
        var h1 = el("h1", "display name", D.personal.name);
        h1.id = "name";
        who.appendChild(h1);
        who.appendChild(el("p", "role", pick(D.title)));
        who.appendChild(el("p", "loc", profile.location(lang)));
        wrap.appendChild(who);

        var about = el("div", "about");
        pick(D.about).forEach(function (para) {
            about.appendChild(el("p", "lede", para));
        });
        var actions = el("p", "actions");
        actions.appendChild(link("mailto:" + D.personal.email, ui.cta_email, "btn btn-solid"));
        actions.appendChild(link("/simon-brunou-cv.pdf", ui.cta_cv, "btn btn-line", { download: true }));
        about.appendChild(actions);
        wrap.appendChild(about);

        sec.appendChild(wrap);
        return sec;
    }

    function renderShot(shot, eager) {
        var fig = el("figure", "shot");
        var crop = el("div", "crop");
        crop.style.setProperty("--ard", String(shot.crop.wide));
        crop.style.setProperty("--arm", String(shot.crop.narrow.ratio));
        crop.style.setProperty("--cx", String(shot.crop.narrow.x));
        crop.style.setProperty("--cy", String(shot.crop.narrow.y));
        crop.style.setProperty("--cw", String(shot.crop.narrow.w));
        crop.style.setProperty("--r", String(shot.height / shot.width));
        var img = el("img");
        img.src = shot.src;
        img.width = shot.width;
        img.height = shot.height;
        img.alt = pick(shot.alt);
        img.decoding = "async";
        if (!eager) img.loading = "lazy";
        crop.appendChild(img);
        fig.appendChild(crop);
        return fig;
    }

    function renderBand(p, first) {
        var ui = D.ui[lang];
        var sec = el("section", "band band-" + p.id + (profile.isMirrored(p) ? " band-mirrored" : ""));
        Object.keys(p.palette).forEach(function (key) {
            sec.style.setProperty("--band-" + key, p.palette[key]);
        });
        var headingId = "project-" + p.id;
        sec.setAttribute("aria-labelledby", headingId);

        var text = el("div", "band-text");
        var head = el("div", "name-row");
        var h = el("h2", "display pname", p.name);
        h.id = headingId;
        head.appendChild(h);
        head.appendChild(el("span", "year", p.year));
        text.appendChild(head);
        text.appendChild(el("p", "summary", pick(p.summary)));
        text.appendChild(el("p", "details", pick(p.details)));
        text.appendChild(el("p", "stack", p.stack.join(", ")));
        var links = el("p", "plinks");
        if (p.url) {
            links.appendChild(link(p.url, ui.visit + " " + hostOf(p.url), "plink plink-main"));
            links.appendChild(link(p.repoUrl, ui.source, "plink"));
        } else {
            links.appendChild(link(p.repoUrl, ui.source + " " + hostOf(p.repoUrl), "plink plink-main"));
        }
        text.appendChild(links);
        sec.appendChild(text);

        var shots = el("div", "band-shots");
        p.shots.forEach(function (shot, i) {
            shots.appendChild(renderShot(shot, first && i === 0));
        });
        sec.appendChild(shots);
        return sec;
    }

    function renderMore(projects) {
        var sec = el("section", "more");
        sec.setAttribute("aria-labelledby", "more-title");
        var wrap = el("div", "wrap more-row");
        var h = el("h2", "display more-title", D.ui[lang].more_title);
        h.id = "more-title";
        wrap.appendChild(h);
        projects.forEach(function (p) {
            var line = el("p", "more-line");
            line.appendChild(link(p.url || p.repoUrl, p.name, "more-name"));
            line.appendChild(document.createTextNode(". " + pick(p.summary)));
            wrap.appendChild(line);
        });
        sec.appendChild(wrap);
        return sec;
    }

    function renderJob(job, isMain) {
        var ui = D.ui[lang];
        var art = el("article", "job" + (isMain ? " job-main" : ""));
        var grid = el("div", "wrap job-grid");

        var head = el("div", "job-head");
        head.appendChild(el("h3", "display job-co", pick(job.company)));
        if (isMain) head.appendChild(el("span", "year", profile.employerYears(job)));
        grid.appendChild(head);

        var meta = el("ul", "job-meta");
        job.positions.forEach(function (pos) {
            var li = el("li", "job-pos");
            li.appendChild(el("span", "job-role", pick(pos.role)));
            li.appendChild(el("span", "job-period", profile.period(pos, lang)));
            meta.appendChild(li);
        });
        grid.appendChild(meta);

        var body = el("div", "job-body");
        body.appendChild(el("p", "job-sum", pick(job.summary)));
        var det = el("details", "job-more");
        det.appendChild(el("summary", "", ui.detail_label));
        var grouped = job.positions.length > 1;
        job.positions.forEach(function (pos) {
            if (grouped) det.appendChild(el("p", "job-more-role", pick(pos.role) + ", " + profile.period(pos, lang)));
            var ul = el("ul");
            pick(pos.description).forEach(function (b) {
                ul.appendChild(el("li", "", b));
            });
            det.appendChild(ul);
        });
        body.appendChild(det);
        grid.appendChild(body);

        art.appendChild(grid);
        return art;
    }

    function renderExperience() {
        var sec = el("section", "experience");
        sec.setAttribute("aria-labelledby", "experience-title");
        var head = el("div", "wrap");
        var h = el("h2", "display section-title", D.ui[lang].experience_title);
        h.id = "experience-title";
        head.appendChild(h);
        sec.appendChild(head);

        // The Main job gets its own slate band.
        D.experience.forEach(function (job) {
            sec.appendChild(renderJob(job, job === profile.mainJob));
        });
        return sec;
    }

    function renderFacts() {
        var ui = D.ui[lang];
        var sec = el("section", "facts");
        sec.setAttribute("aria-labelledby", "facts-title");
        var wrap = el("div", "wrap");
        var h = el("h2", "display section-title", ui.facts_title);
        h.id = "facts-title";
        wrap.appendChild(h);

        profile.skillGroups.forEach(function (group) {
            var block = el("div", "skill skill-" + group.key);
            block.appendChild(el("h3", "fact-label", pick(group.label)));
            block.appendChild(el("p", "display skill-run", group.skills.join(", ")));
            wrap.appendChild(block);
        });

        var two = el("div", "facts-two");

        var edu = el("div", "facts-col");
        edu.appendChild(el("h3", "fact-label", ui.education_label));
        var eul = el("ul", "fact-list");
        D.education.forEach(function (e) {
            var li = el("li", "fact fact-edu");
            li.appendChild(el("span", "display fact-degree", pick(e.degree)));
            li.appendChild(el("span", "fact-school", e.school + ", " + e.startYear + "\u2013" + e.endYear));
            eul.appendChild(li);
        });
        edu.appendChild(eul);
        two.appendChild(edu);

        var spoken = el("div", "facts-col");
        spoken.appendChild(el("h3", "fact-label", ui.spoken_label));
        var sul = el("ul", "fact-list");
        D.languages.forEach(function (l) {
            var li = el("li", "fact fact-spoken");
            li.appendChild(el("span", "display fact-lang", pick(l.name)));
            li.appendChild(el("span", "fact-level", pick(l.level)));
            sul.appendChild(li);
        });
        spoken.appendChild(sul);
        two.appendChild(spoken);

        wrap.appendChild(two);
        sec.appendChild(wrap);
        return sec;
    }

    function renderContact() {
        var ui = D.ui[lang];
        var P = D.personal;
        var foot = el("footer", "contact");
        foot.setAttribute("aria-labelledby", "contact-title");
        var wrap = el("div", "wrap");
        var h = el("h2", "display section-title", ui.contact_title);
        h.id = "contact-title";
        wrap.appendChild(h);
        wrap.appendChild(el("p", "contact-text", ui.contact_text));
        wrap.appendChild(link("mailto:" + P.email, P.email, "contact-mail"));

        var ul = el("ul", "contact-links");
        [
            link(P.githubUrl, P.githubDisplay, "contact-link", { me: true }),
            link(P.linkedinUrl, P.linkedinDisplay, "contact-link", { me: true }),
            link("/simon-brunou-cv.pdf", ui.cta_cv, "contact-link", { download: true }),
        ].forEach(function (a) {
            var li = el("li");
            li.appendChild(a);
            ul.appendChild(li);
        });
        wrap.appendChild(ul);
        wrap.appendChild(el("p", "colophon", ui.footer));
        foot.appendChild(wrap);
        return foot;
    }

    // One Person block in <head>, rewritten in the Visitor's language.
    function renderJsonLd() {
        var block = document.head.querySelector('script[type="application/ld+json"]');
        if (!block) {
            block = document.createElement("script");
            block.type = "application/ld+json";
            document.head.appendChild(block);
        }
        block.textContent = JSON.stringify(profile.personJsonLd(lang));
    }

    function render() {
        document.documentElement.lang = lang;
        document.title = D.ui[lang].page_title;
        renderJsonLd();

        var main = el("main");
        main.appendChild(renderIntro());
        var banded = D.projects.filter(profile.isFeatured);
        var rest = D.projects.filter(function (p) {
            return !profile.isFeatured(p);
        });
        banded.forEach(function (p, i) {
            main.appendChild(renderBand(p, i === 0));
        });
        if (rest.length) main.appendChild(renderMore(rest));
        main.appendChild(renderExperience());
        main.appendChild(renderFacts());

        root.textContent = "";
        root.appendChild(main);
        root.appendChild(renderContact());
    }

    render();
})();
