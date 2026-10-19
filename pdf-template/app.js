// CV renderer. Fills pdf-template/index.html from the Profile (profile.js),
// in French.
import profile, { pick } from '../profile.js';
import { recordOutcome } from './render-outcome.js';

(function () {
    var D = profile.data;
    var lang = 'fr';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function link(url, className) {
        var a = el('a', className, url.replace(/^https?:\/\//, ''));
        a.href = url;
        return a;
    }

    function clear(id) {
        var node = document.getElementById(id);
        node.textContent = '';
        return node;
    }

    // Header
    var P = D.personal;
    document.getElementById('resume-role').textContent = pick(D.title, lang);
    document.getElementById('resume-location').textContent = profile.location(lang);

    var contact = clear('resume-contact');
    function addContact(node) {
        var li = el('li');
        li.appendChild(node);
        contact.appendChild(li);
    }
    var mail = el('a', '', P.email);
    mail.href = 'mailto:' + P.email;
    addContact(mail);
    var tel = el('a', '', pick(P.phoneDisplay, lang));
    tel.href = 'tel:' + P.phone;
    addContact(tel);
    addContact(link(P.websiteUrl));
    var gh = el('a', '', P.githubDisplay);
    gh.href = P.githubUrl;
    addContact(gh);
    var lk = el('a', '', P.linkedinDisplay);
    lk.href = P.linkedinUrl;
    addContact(lk);

    // Profil
    var about = clear('resume-about');
    pick(D.about, lang).forEach(function (para) {
        about.appendChild(el('p', 'about-p', para));
    });

    // Projets
    function strip(className, name, span) {
        var s = el('div', 'strip ' + className);
        s.appendChild(el('h3', 'strip-name', name));
        s.appendChild(el('span', 'date', span));
        return s;
    }

    var projBox = clear('resume-projects');
    D.projects.forEach(function (p) {
        if (!profile.isFeatured(p)) {
            var row = el('div', 'project-line');
            row.appendChild(el('h3', 'line-name', p.name));
            var text = el('p', 'line-text');
            text.appendChild(document.createTextNode(pick(p.summary, lang) + ' '));
            text.appendChild(el('span', 'stack-inline', p.stack.join(', ') + '.'));
            row.appendChild(text);
            var meta = el('div', 'line-links');
            if (p.url) meta.appendChild(link(p.url));
            meta.appendChild(link(p.repoUrl));
            row.appendChild(meta);
            row.appendChild(el('span', 'date', p.year));
            projBox.appendChild(row);
            return;
        }

        var box = el('article', 'project');
        // The project's Band palette, as on the homepage.
        var head = strip('strip-project', p.name, p.year);
        Object.keys(p.palette).forEach(function (key) {
            head.style.setProperty('--band-' + key, p.palette[key]);
        });
        box.appendChild(head);
        var body = el('div', 'project-body');
        body.appendChild(el('p', 'summary', pick(p.summary, lang)));
        body.appendChild(el('p', 'details', pick(p.details, lang)));
        var foot = el('div', 'project-foot');
        var stack = el('p', 'stack');
        stack.appendChild(el('strong', '', 'Stack\u00a0: '));
        stack.appendChild(document.createTextNode(p.stack.join(', ')));
        foot.appendChild(stack);
        var links = el('p', 'links');
        if (p.url) links.appendChild(link(p.url));
        links.appendChild(link(p.repoUrl));
        foot.appendChild(links);
        body.appendChild(foot);
        box.appendChild(body);
        projBox.appendChild(box);
    });

    // Expérience
    // The Main job gets the slate strip, as on the homepage.
    // Page 1 ends with the first employer; the others open page 2.
    var expBox = clear('resume-experience');
    var expMore = clear('resume-experience-more');
    D.experience.forEach(function (e, index) {
        var company = pick(e.company, lang);
        var box = el('article', 'employer');
        if (e === profile.mainJob) {
            box.appendChild(strip('strip-main', company, profile.employerYears(e)));
        } else {
            var head = el('div', 'employer-head');
            head.appendChild(el('h3', 'employer-name', company));
            head.appendChild(el('span', 'date', profile.employerYears(e)));
            box.appendChild(head);
        }

        var body = el('div', 'employer-body');
        e.positions.forEach(function (pos) {
            var posBox = el('div', 'position');
            var h = el('div', 'position-head');
            h.appendChild(el('h4', 'role-name', pick(pos.role, lang)));
            h.appendChild(el('span', 'date', profile.period(pos, lang)));
            posBox.appendChild(h);
            var ul = el('ul', 'bullets');
            pick(pos.description, lang).forEach(function (line) {
                ul.appendChild(el('li', '', line));
            });
            posBox.appendChild(ul);
            body.appendChild(posBox);
        });
        box.appendChild(body);
        (index === 0 ? expBox : expMore).appendChild(box);
    });

    // Compétences
    var skills = clear('resume-skills');
    profile.skillGroups.forEach(function (group) {
        var row = el('div', 'skills-row');
        row.appendChild(el('h3', 'skills-label', pick(group.label, lang)));
        row.appendChild(el('p', 'skills-list', group.skills.join(', ')));
        skills.appendChild(row);
    });

    // Formation
    var edu = clear('resume-education');
    D.education.forEach(function (ed) {
        var row = el('div', 'edu-row');
        var text = el('div', 'edu-text');
        text.appendChild(el('strong', 'edu-degree', pick(ed.degree, lang)));
        text.appendChild(document.createTextNode(', ' + ed.school));
        row.appendChild(text);
        row.appendChild(el('span', 'date', ed.startYear + '\u2013' + ed.endYear));
        edu.appendChild(row);
    });

    // Langues
    var langs = clear('resume-languages');
    D.languages.forEach(function (l) {
        var item = el('li');
        item.appendChild(el('strong', '', pick(l.name, lang)));
        item.appendChild(document.createTextNode(', ' + pick(l.level, lang).toLowerCase()));
        langs.appendChild(item);
    });

    // Centres d'intérêt
    document.getElementById('resume-interests').textContent = D.interests
        .map(function (i) { return pick(i, lang); })
        .join(', ');

    // The pages are filled. render-outcome.js waits for the images and fonts,
    // checks the pages and records the outcome for build-pdf.js.
    recordOutcome();
})();
