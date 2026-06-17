(function () {
    var D = window.RESUME_DATA;
    var P = D.personal;
    var pick = window.SBRender.pickLang;
    var backToTop = document.getElementById("back-to-top");

    // Theme toggle
    function isLight() {
        return document.documentElement.classList.contains("light");
    }
    function updateThemeIcon() {
        var isLightNow = isLight();
        var btn = document.getElementById("theme-toggle");
        // aria-pressed=true means "light theme is the active choice"
        if (btn) btn.setAttribute("aria-pressed", isLightNow ? "true" : "false");
        var moon = document.getElementById("theme-icon-moon");
        var sun  = document.getElementById("theme-icon-sun");
        if (moon) moon.hidden = isLightNow;   // hide moon when light theme is active
        if (sun)  sun.hidden  = !isLightNow;  // show sun when light theme is active
    }
    function toggleTheme() {
        var light = !isLight();
        document.documentElement.classList.toggle("light", light);
        try { localStorage.setItem("theme", light ? "light" : "dark"); } catch (_) {}
        updateThemeIcon();
        if (window.__setThemeColor) window.__setThemeColor(light);
    }
    updateThemeIcon();

    // Render all bilingual content for the given lang.
    // Called once at startup and again on every language toggle.
    // All DOM mutations use textContent / createElement — never innerHTML
    // with interpolated data values.
    function render(lang) {
        // Update page title for current language
        document.title = D.ui[lang].page_title;

        // Page-control labels (skip link text, theme + back-to-top aria-labels)
        var skipLink = document.querySelector('.skip-link[data-i18n="skip_link"]');
        if (skipLink) skipLink.textContent = D.ui[lang].skip_link;

        var themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.setAttribute('aria-label', D.ui[lang].theme_toggle);

        var backTop = document.getElementById('back-to-top') || document.querySelector('.back-to-top');
        if (backTop) backTop.setAttribute('aria-label', D.ui[lang].back_to_top);

        // Hero
        document.getElementById('hero-eyebrow').textContent = pick(D.personal.location, lang);
        document.getElementById('hero-role').textContent = pick(D.title, lang);
        document.getElementById('hero-cta').textContent = D.ui[lang].cta + ' →';
        document.getElementById('hero-resume-link').textContent = D.ui[lang].resume_link;

        if (D.availability && D.availability.open) {
            document.getElementById('hero-status-label').textContent = pick(D.availability.label, lang);
            document.getElementById('hero-status').hidden = false;
        }

        // About
        document.getElementById('about-eyebrow').textContent = D.ui[lang].about_title;
        document.getElementById('about-heading').textContent = D.ui[lang].section_heading_about;
        document.getElementById('about-text').textContent = pick(D.about, lang);

        // Skills eyebrow + heading
        document.getElementById('skills-eyebrow').textContent = D.ui[lang].skills_title;
        document.getElementById('skills-heading').textContent = D.ui[lang].section_heading_skills;

        // Generate skills — DOM construction only (no innerHTML for data values)
        var grid = document.getElementById('skills-grid');
        grid.textContent = '';
        ['languages', 'frameworks', 'tools'].forEach(function (cat) {
            var card = document.createElement('div');
            card.className = 'skill-cat';

            var catLabel = document.createElement('div');
            catLabel.className = 'skill-cat-label';
            catLabel.textContent = '// ' + pick(D.skillCategoryLabels[cat], lang).toLowerCase();
            card.appendChild(catLabel);

            var chips = document.createElement('div');
            chips.className = 'chips';
            D.skills[cat].forEach(function (s) {
                var c = document.createElement('span');
                c.className = 'chip-skill';
                c.textContent = s;
                chips.appendChild(c);
            });
            card.appendChild(chips);

            grid.appendChild(card);
        });

        // Experience eyebrow + heading
        document.getElementById('experience-eyebrow').textContent = D.ui[lang].exp_title;
        document.getElementById('experience-heading').textContent = D.ui[lang].section_heading_exp;

        // Generate experience timeline — DOM construction only (no innerHTML for data values)
        var tl = document.getElementById('experience-timeline');
        tl.textContent = '';
        D.experience.forEach(function (exp) {
            var item = document.createElement('div');
            item.className = 'tl-item';

            var meta = document.createElement('div');
            meta.className = 'tl-meta';
            meta.textContent = pick(exp.period, lang);
            item.appendChild(meta);

            var role = document.createElement('h3');
            role.textContent = pick(exp.role, lang);
            item.appendChild(role);

            var co = document.createElement('div');
            co.className = 'tl-company';
            co.textContent = pick(exp.company, lang);
            item.appendChild(co);

            var ul = document.createElement('ul');
            pick(exp.description, lang).forEach(function (b) {
                var li = document.createElement('li');
                li.textContent = b;
                ul.appendChild(li);
            });
            item.appendChild(ul);

            tl.appendChild(item);
        });

        // Projects
        document.getElementById('projects-eyebrow').textContent = D.ui[lang].projects_title;
        document.getElementById('projects-heading').textContent = D.ui[lang].section_heading_projects;
        var projectsGrid = document.getElementById('projects-grid');
        projectsGrid.textContent = '';
        (D.projects || []).forEach(function (p) {
            var card = document.createElement('article');
            card.className = 'project-card';

            var head = document.createElement('div');
            head.className = 'project-head';
            var name = document.createElement('h3');
            name.className = 'project-name';
            name.textContent = p.name;
            head.appendChild(name);
            var period = document.createElement('span');
            period.className = 'project-period';
            period.textContent = pick(p.period, lang);
            head.appendChild(period);
            card.appendChild(head);

            var tagline = document.createElement('p');
            tagline.className = 'project-tagline';
            tagline.textContent = pick(p.tagline, lang);
            card.appendChild(tagline);

            var ul = document.createElement('ul');
            pick(p.description, lang).forEach(function (b) {
                var li = document.createElement('li');
                li.textContent = b;
                ul.appendChild(li);
            });
            card.appendChild(ul);

            if (p.stack && p.stack.length) {
                var stack = document.createElement('div');
                stack.className = 'project-stack chips';
                p.stack.forEach(function (s) {
                    var c = document.createElement('span');
                    c.className = 'chip-skill';
                    c.textContent = s;
                    stack.appendChild(c);
                });
                card.appendChild(stack);
            }

            var links = document.createElement('div');
            links.className = 'project-links';
            if (p.url) {
                var visit = document.createElement('a');
                visit.className = 'project-link';
                visit.href = p.url;
                visit.rel = 'noopener';
                visit.target = '_blank';
                var visitText = document.createTextNode(D.ui[lang].projects_visit + ' ↗');
                visit.appendChild(visitText);
                var visitSr = document.createElement('span');
                visitSr.className = 'sr-only';
                visitSr.textContent = ' ' + D.ui[lang].new_tab;
                visit.appendChild(visitSr);
                links.appendChild(visit);
            }
            if (p.repoUrl) {
                var src = document.createElement('a');
                src.className = 'project-link';
                src.href = p.repoUrl;
                src.rel = 'noopener';
                src.target = '_blank';
                var srcText = document.createTextNode(D.ui[lang].projects_source);
                src.appendChild(srcText);
                var srcSr = document.createElement('span');
                srcSr.className = 'sr-only';
                srcSr.textContent = ' ' + D.ui[lang].new_tab;
                src.appendChild(srcSr);
                links.appendChild(src);
            }
            card.appendChild(links);

            projectsGrid.appendChild(card);
        });

        // Education
        document.getElementById('education-eyebrow').textContent = D.ui[lang].edu_title;
        document.getElementById('education-heading').textContent = D.ui[lang].section_heading_edu;
        var eduGrid = document.getElementById('education-grid');
        eduGrid.textContent = '';
        D.education.forEach(function (e) {
            var card = document.createElement('div');
            card.className = 'edu-card';

            var degree = document.createElement('div');
            degree.className = 'degree';
            degree.textContent = pick(e.degree, lang);
            card.appendChild(degree);

            var school = document.createElement('div');
            school.className = 'school';
            school.textContent = e.school;
            card.appendChild(school);

            var year = document.createElement('div');
            year.className = 'year';
            year.textContent = e.startYear + ' — ' + e.endYear;
            card.appendChild(year);

            eduGrid.appendChild(card);
        });

        // Languages
        document.getElementById('languages-eyebrow').textContent = D.ui[lang].lang_title;
        document.getElementById('languages-heading').textContent = D.ui[lang].section_heading_lang;
        var langGrid = document.getElementById('languages-grid');
        langGrid.textContent = '';
        D.languages.forEach(function (l) {
            var card = document.createElement('div');
            card.className = 'lang-card';
            var name = document.createElement('div');
            name.className = 'name';
            name.textContent = pick(l.name, lang);
            card.appendChild(name);
            var level = document.createElement('div');
            level.className = 'level';
            level.textContent = pick(l.level, lang);
            card.appendChild(level);
            langGrid.appendChild(card);
        });

        // Interests
        document.getElementById('interests-eyebrow').textContent = D.ui[lang].interests_title;
        document.getElementById('interests-heading').textContent = D.ui[lang].section_heading_interests;
        var iRow = document.getElementById('interests-row');
        iRow.textContent = '';
        D.interests.forEach(function (interest) {
            var s = document.createElement('span');
            s.className = 'interest';
            s.textContent = interest.emoji + ' ' + pick(interest.label, lang);
            iRow.appendChild(s);
        });

        // Contact
        document.getElementById('contact-eyebrow').textContent = D.ui[lang].contact_title;
        document.getElementById('contact-heading-text').textContent = D.ui[lang].section_heading_contact;
        document.getElementById('contact-text').textContent = D.ui[lang].contact_text;

        var cLinks = document.getElementById('contact-links');
        cLinks.textContent = '';
        [
            { href: 'mailto:' + D.personal.email, label: D.personal.email, external: false },
            { href: D.personal.githubUrl, label: D.personal.githubDisplay, external: true },
            { href: D.personal.linkedinUrl, label: D.personal.linkedinDisplay, external: true },
        ].forEach(function (l) {
            var a = document.createElement('a');
            a.className = 'contact-link';
            a.href = l.href;
            a.textContent = l.label;
            if (l.external) {
                a.rel = 'me noopener';
                a.target = '_blank';
                var srHint = document.createElement('span');
                srHint.className = 'sr-only';
                srHint.textContent = ' ' + D.ui[lang].new_tab;
                a.appendChild(srHint);
            }
            cLinks.appendChild(a);
        });

        // Footer
        document.getElementById('footer-text').textContent = D.ui[lang].footer;
    }

    // Update aria-current on language toggle buttons.
    function syncLangButtons(activeLang) {
        document.querySelectorAll('.lang-toggle button[data-lang]').forEach(function (b) {
            b.setAttribute('aria-current', b.getAttribute('data-lang') === activeLang ? 'true' : 'false');
        });
    }

    // Generate SR summary via DOM construction (language-neutral, English only).
    // Uses createElement + textContent throughout — no innerHTML on data values.
    (function buildSrSummary() {
        var allSkills = D.skills.languages.concat(D.skills.frameworks, D.skills.tools);
        var langSummary = D.languages.map(function (l) { return l.name.en + ' (' + l.level.en + ')'; }).join(', ');
        var sr = document.getElementById('sr-summary');
        sr.textContent = '';

        function addEl(tag, text) {
            var el = document.createElement(tag);
            el.textContent = text;
            sr.appendChild(el);
        }

        addEl('h1', P.name + ' — ' + D.title.en);
        addEl('p', 'Email: ' + P.email + ' | Phone: ' + P.phoneDisplay.en);
        addEl('p', 'Location: ' + P.location.en);
        addEl('p', 'GitHub: ' + P.githubUrl + ' | LinkedIn: ' + P.linkedinUrl);
        addEl('h2', 'Summary');
        addEl('p', D.about.en);
        addEl('h2', 'Skills');
        addEl('p', allSkills.join(', '));
        addEl('h2', 'Languages');
        addEl('p', langSummary);
    })();

    // Language resolution priority: URL ?lang= (for hreflang
    // arrivals and shareable English / French links) > localStorage
    // > default EN. An explicit URL value wins even if it matches
    // the default — `?lang=en` must force English when localStorage
    // would otherwise restore a previous French session.
    var initialLang = 'en';
    var hadExplicitLang = false;
    try {
        var params = new URLSearchParams(window.location.search);
        var fromUrl = params.get('lang');
        if (fromUrl === 'fr' || fromUrl === 'en') {
            initialLang = fromUrl;
            hadExplicitLang = true;
        }
    } catch (_) {}
    if (!hadExplicitLang) {
        try {
            var stored = localStorage.getItem('lang');
            if (stored === 'fr') { initialLang = 'fr'; }
        } catch (_) {}
    }

    document.documentElement.lang = initialLang;
    render(initialLang);
    syncLangButtons(initialLang);

    // Generate JSON-LD via shared helper once at startup
    SBRender.injectJsonLd(D, initialLang);

    // EN/FR toggle handlers — call render() so all new sections update live
    document.querySelectorAll('.lang-toggle button[data-lang]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var newLang = btn.getAttribute('data-lang');
            try { localStorage.setItem('lang', newLang); } catch (_) {}
            document.documentElement.lang = newLang;
            syncLangButtons(newLang);
            render(newLang);
            var announcer = document.getElementById('a11y-announcer');
            if (announcer) {
                announcer.textContent = '';
                setTimeout(function () { announcer.textContent = D.ui[newLang].lang_switched; }, 100);
            }
        });
    });

    // Scroll progress + back-to-top
    var progressBar = document.getElementById("scroll-progress");
    var ticking = false;
    function updateScrollUI() {
        var h = document.documentElement;
        var scrollable = h.scrollHeight - h.clientHeight;
        var progress = scrollable > 0 ? h.scrollTop / scrollable : 0;
        progressBar.style.transform = "scaleX(" + progress + ")";
        backToTop.classList.toggle("visible", h.scrollTop > 600);
        ticking = false;
    }
    function onScrollOrResize() {
        if (!ticking) {
            window.requestAnimationFrame(updateScrollUI);
            ticking = true;
        }
    }
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    updateScrollUI();
    backToTop.addEventListener("click", function () {
        var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });

    // Fade-in observer. Without IntersectionObserver (old browsers
    // or sandboxed contexts where it's stripped), the .js .fade-in
    // rule would leave sections invisible forever — reveal them
    // immediately as a fallback. Use a `for` loop, not
    // NodeList.forEach, because browsers without IO also tend to
    // lack NodeList.prototype.forEach.
    var fadeEls = document.querySelectorAll(".fade-in");
    if (typeof IntersectionObserver === "function") {
        var o = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                        o.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15 }
        );
        for (var i = 0; i < fadeEls.length; i++) o.observe(fadeEls[i]);
    } else {
        for (var j = 0; j < fadeEls.length; j++) fadeEls[j].classList.add("visible");
    }
    // Observer is wired (or fallback applied) — cancel the head's
    // safety-net rescue so it doesn't reveal off-screen sections
    // prematurely on users who linger above the fold.
    if (window.__fadeRescueId) {
        clearTimeout(window.__fadeRescueId);
        window.__fadeRescueId = null;
    }

    // Wire up theme toggle
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
})();
