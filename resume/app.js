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

    // JSON-LD via shared helper (same shape on both pages)
    SBRender.injectJsonLd(D, lang);

    // MUST stay verbatim: image-load barrier + data-render-complete sentinel.
    // The PDF render path (Puppeteer) waits on html[data-render-complete] before
    // snapshotting. Don't fire it before in-document images finish loading or the
    // PDF can race past the profile photo.
    var imgs = Array.prototype.slice.call(document.images);
    Promise.all(imgs.map(function (img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function (resolve) {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    })).then(function () {
        document.documentElement.setAttribute('data-render-complete', '');
    });
})();

// Cloudflare Turnstile — protects the PDF generation endpoint
// Replace the sitekey with your own from the Cloudflare Dashboard.
// The matching secret is provisioned server-side via the
// TURNSTILE_SECRET_KEY env var (see .env.example / Coolify env tab).
(function () {
    // Skip Turnstile when the page is loaded by Puppeteer for PDF generation
    if (new URLSearchParams(window.location.search).get("pdf")) return;

    // 30s — generous for a cold browser rendering worker but well
    // under the 60s default rate-limit window.
    var PDF_TIMEOUT_MS = 30000;
    var pdfBtnInner = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/></svg>PDF';
    var widgetId;

    function getBtn() { return document.getElementById("download-pdf"); }
    function getStatus() { return document.getElementById("pdf-status"); }

    function setLoading(loading) {
        var btn = getBtn();
        if (btn) {
            btn.disabled = loading;
            btn.setAttribute("aria-busy", loading ? "true" : "false");
            // existing pattern: pdfBtnInner is a constant SVG string controlled by this file.
            btn.innerHTML = loading ? pdfBtnInner.replace("PDF", "…") : pdfBtnInner;
        }
        var s = getStatus();
        if (s && loading) s.textContent = "Génération du PDF…";
    }

    function setError(msg) {
        var btn = getBtn();
        if (btn) {
            btn.title = msg;
            btn.classList.add("pdf-error");
        }
        var s = getStatus();
        if (s) s.textContent = msg;
    }

    function clearError() {
        var btn = getBtn();
        if (btn) {
            btn.title = "Télécharger en PDF";
            btn.classList.remove("pdf-error");
        }
    }

    function messageForStatus(status) {
        if (status === 429) return "Trop de demandes. Réessayez dans une minute.";
        if (status === 403) return "Vérification échouée. Rechargez la page et réessayez.";
        if (status === 503) return "Service indisponible. Réessayez plus tard.";
        return "Échec du téléchargement (" + status + "). Réessayez.";
    }

    function downloadPDF(token) {
        clearError();
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, PDF_TIMEOUT_MS);
        fetch("/resume/simon-brunou-cv.pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token }),
            signal: controller.signal,
        })
            .then(function (r) {
                if (!r.ok) {
                    var err = new Error("status_" + r.status);
                    err.status = r.status;
                    throw err;
                }
                return r.blob();
            })
            .then(function (blob) {
                var blobUrl = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = blobUrl;
                a.download = "simon-brunou-cv.pdf";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                var s = getStatus();
                if (s) s.textContent = "PDF téléchargé.";
            })
            .catch(function (err) {
                if (err && err.name === "AbortError") {
                    setError("La génération du PDF a expiré. Réessayez.");
                } else if (err && typeof err.status === "number") {
                    setError(messageForStatus(err.status));
                } else {
                    setError("Échec du téléchargement. Vérifiez votre connexion.");
                }
            })
            .finally(function () {
                clearTimeout(timer);
                setLoading(false);
                if (widgetId !== undefined) turnstile.reset(widgetId);
            });
    }

    var turnstileOpts = {
        sitekey: "0x4AAAAAACvBqO10GT9_Ajun",
        // Keep the widget out of the layout in Managed and
        // Non-Interactive sitekey modes too — "interaction-only"
        // hides the box unless an interactive challenge is
        // genuinely required, so the PDF flow stays silent for
        // the vast majority of visitors. (The old `size:
        // "invisible"` was removed by Cloudflare; invisibility
        // is now driven by the sitekey mode in the dashboard
        // plus this appearance setting.)
        appearance: "interaction-only",
        // Defer the challenge until the user clicks the PDF button.
        // Without this, Turnstile defaults to execution:"render",
        // which runs the challenge immediately when the widget is
        // rendered → success callback fires → downloadPDF runs →
        // PDF generated on every page visit. With "execute", the
        // widget waits for turnstile.execute(widgetId) — called
        // from the button click handler below.
        execution: "execute",
        callback: function (token) { downloadPDF(token); },
        "error-callback": function () { setLoading(false); },
        "expired-callback": function () { setLoading(false); },
    };

    window.onloadTurnstileCallback = function () {
        widgetId = turnstile.render("#cf-turnstile", turnstileOpts);

        var btn = getBtn();
        if (btn) {
            btn.addEventListener("click", function () {
                setLoading(true);
                turnstile.execute(widgetId);
            });
        }
    };

    // Re-render the widget when the page is restored from bfcache
    window.addEventListener("pageshow", function (e) {
        if (e.persisted && typeof turnstile !== "undefined" && widgetId !== undefined) {
            turnstile.remove(widgetId);
            widgetId = turnstile.render("#cf-turnstile", turnstileOpts);
        }
    });
})();
