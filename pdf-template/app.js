(function () {
    var D = window.RESUME_DATA;
    var lang = 'fr';
    var pick = window.SBRender.pickLang;

    document.getElementById('resume-role').textContent = pick(D.title, lang);
    document.getElementById('resume-contact').textContent =
        D.personal.email + ' · ' + pick(D.personal.phoneDisplay, lang) + ' · ' + D.personal.githubDisplay;

    document.getElementById('resume-about').textContent = pick(D.about, lang);

    document.getElementById('resume-skills-languages').textContent = D.skills.languages.join(', ');
    document.getElementById('resume-skills-frameworks').textContent = D.skills.frameworks.join(', ');
    document.getElementById('resume-skills-tools').textContent = D.skills.tools.join(', ');

    var expBox = document.getElementById('resume-experience');
    expBox.textContent = '';
    D.experience.forEach(function (e) {
        var entry = document.createElement('div');
        entry.className = 'entry';

        var head = document.createElement('div');
        head.className = 'entry-head';
        var pos = document.createElement('div');
        pos.className = 'pos';
        pos.textContent = pick(e.role, lang);
        head.appendChild(pos);
        var period = document.createElement('div');
        period.className = 'period';
        period.textContent = pick(e.period, lang);
        head.appendChild(period);
        entry.appendChild(head);

        var company = document.createElement('div');
        company.className = 'entry-company';
        company.textContent = pick(e.company, lang);
        entry.appendChild(company);

        var ul = document.createElement('ul');
        pick(e.description, lang).forEach(function (b) {
            var li = document.createElement('li');
            li.textContent = b;
            ul.appendChild(li);
        });
        entry.appendChild(ul);

        expBox.appendChild(entry);
    });

    var projBox = document.getElementById('resume-projects');
    projBox.textContent = '';
    (D.projects || []).forEach(function (p) {
        var entry = document.createElement('div');
        entry.className = 'entry';

        var head = document.createElement('div');
        head.className = 'entry-head';
        var pos = document.createElement('div');
        pos.className = 'pos';
        pos.textContent = p.name;
        head.appendChild(pos);
        var period = document.createElement('div');
        period.className = 'period';
        period.textContent = pick(p.period, lang);
        head.appendChild(period);
        entry.appendChild(head);

        var tagline = document.createElement('div');
        tagline.className = 'project-tagline';
        tagline.textContent = pick(p.tagline, lang);
        entry.appendChild(tagline);

        var ul = document.createElement('ul');
        pick(p.description, lang).forEach(function (b) {
            var li = document.createElement('li');
            li.textContent = b;
            ul.appendChild(li);
        });
        entry.appendChild(ul);

        if (p.stack && p.stack.length) {
            var stack = document.createElement('div');
            stack.className = 'project-stack';
            stack.textContent = '// ' + p.stack.join(' · ');
            entry.appendChild(stack);
        }

        var links = document.createElement('div');
        links.className = 'project-links';
        var hasLink = false;
        if (p.url) {
            var visit = document.createElement('a');
            visit.href = p.url;
            visit.rel = 'noopener';
            visit.target = '_blank';
            visit.textContent = p.url.replace(/^https?:\/\//, '');
            links.appendChild(visit);
            hasLink = true;
        }
        if (p.repoUrl) {
            if (hasLink) {
                var sep = document.createElement('span');
                sep.className = 'sep';
                sep.textContent = '·';
                links.appendChild(sep);
            }
            var src = document.createElement('a');
            src.href = p.repoUrl;
            src.rel = 'noopener';
            src.target = '_blank';
            src.textContent = p.repoUrl.replace(/^https?:\/\//, '');
            links.appendChild(src);
            hasLink = true;
        }
        if (hasLink) entry.appendChild(links);

        projBox.appendChild(entry);
    });

    var edu = document.getElementById('resume-education');
    edu.textContent = '';
    D.education.forEach(function (ed) {
        var item = document.createElement('div');
        item.className = 'edu-item';
        var name = document.createElement('div');
        name.className = 'name';
        name.textContent = pick(ed.degree, lang);
        item.appendChild(name);
        var school = document.createElement('div');
        school.className = 'school';
        school.textContent = ed.school;
        item.appendChild(school);
        var year = document.createElement('div');
        year.className = 'year';
        year.textContent = ed.startYear + ' — ' + ed.endYear;
        item.appendChild(year);
        edu.appendChild(item);
    });

    var langs = document.getElementById('resume-languages');
    langs.textContent = '';
    D.languages.forEach(function (l) {
        var item = document.createElement('div');
        item.className = 'lang-item';
        var name = document.createElement('div');
        name.className = 'name';
        name.textContent = pick(l.name, lang);
        item.appendChild(name);
        var level = document.createElement('div');
        level.className = 'level';
        level.textContent = pick(l.level, lang);
        item.appendChild(level);
        langs.appendChild(item);
    });

    var ints = document.getElementById('resume-interests');
    ints.textContent = '';
    D.interests.forEach(function (i) {
        var s = document.createElement('span');
        s.className = 'item';
        s.textContent = i.emoji + ' ' + pick(i.label, lang);
        ints.appendChild(s);
    });

    SBRender.injectJsonLd(D, lang);

    // build-pdf.js waits on html[data-render-complete] before snapshotting,
    // so the sentinel must gate on every resource the rendered PDF depends on:
    //   - images: document.images load events
    //   - webfonts: document.fonts.ready (the @font-face files Google Fonts
    //     pulls in are downloaded lazily, so DOMContentLoaded alone is not
    //     enough — without this, the PDF can snapshot with system fallback
    //     glyphs instead of Inter / JetBrains Mono).
    var imgs = Array.prototype.slice.call(document.images);
    var imgsReady = Promise.all(imgs.map(function (img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function (resolve) {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    }));
    var fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
    Promise.all([imgsReady, fontsReady]).then(function () {
        document.documentElement.setAttribute('data-render-complete', '');
    });
})();
