import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
    HTML_PAGES,
    NOT_FOUND_HTML,
    ROOT_FILES,
    createSiteApp,
    injectNonce,
    loadSiteFiles,
    staticAssets,
} from "../site.js";
import profile, { createProfile } from "../profile.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = await loadSiteFiles(root);
const app = createSiteApp(files);
const assets = staticAssets(files.keys());
const source = (rel) => files.get(rel).toString("utf8");

// Today's policy, written out by hand. Changing the CSP means changing this.
const expectedCsp = (nonce) =>
    "default-src 'self'; " +
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; ` +
    "style-src 'self'; " +
    "img-src 'self'; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'; " +
    "object-src 'none'; " +
    "upgrade-insecure-requests";

const BASELINE = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security":
        "max-age=63072000; includeSubDomains; preload",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
};

// Today's Content-Type and Cache-Control for each static route.
const JS = "application/javascript; charset=utf-8";
const REVALIDATE = "public, max-age=0, must-revalidate";
const STATIC_HEADERS = {
    "/data.js": [JS, REVALIDATE],
    "/profile.js": [JS, REVALIDATE],
    "/app.js": [JS, REVALIDATE],
    "/styles.css": ["text/css; charset=utf-8", REVALIDATE],
    "/photo.png": [
        "image/png",
        "public, max-age=604800, s-maxage=2592000, immutable",
    ],
    "/favicon.svg": ["image/svg+xml", "public, max-age=604800"],
    "/images/diversif-home.webp": ["image/webp", "public, max-age=86400"],
    "/images/diversif-allergens.webp": ["image/webp", "public, max-age=86400"],
    "/images/cinder-library.webp": ["image/webp", "public, max-age=86400"],
    "/images/cinder-dashboard.webp": ["image/webp", "public, max-age=86400"],
    "/fonts/big-shoulders-display-latin.woff2": [
        "font/woff2",
        "public, max-age=2592000",
    ],
    "/fonts/besley-latin.woff2": ["font/woff2", "public, max-age=2592000"],
    "/simon-brunou-cv.pdf": ["application/pdf", "public, max-age=3600"],
    "/robots.txt": ["text/plain; charset=utf-8", "public, max-age=3600"],
    "/sitemap.xml": ["application/xml; charset=utf-8", "public, max-age=3600"],
};

// Every HTML response the site can send: each page, and the 404 page.
const HTML_RESPONSES = [...Object.entries(HTML_PAGES), ["/nope", NOT_FOUND_HTML]];

// 16 random bytes, base64-encoded.
const NONCE_RE = /'nonce-([A-Za-z0-9+/]{22}==)'/;
const SCRIPT_TAG_RE = /<script(?=[\s>])[^>]*>/gi;

function nonceOf(res) {
    const csp = res.headers.get("Content-Security-Policy");
    assert.ok(csp, "response has no Content-Security-Policy header");
    const match = csp.match(NONCE_RE);
    assert.ok(match, `no nonce in CSP: ${csp}`);
    return match[1];
}

test("CSP script-src holds a per-request nonce and 'strict-dynamic'", async () => {
    for (const [route] of HTML_RESPONSES) {
        const res = await app.request(route);
        const nonce = nonceOf(res);
        assert.equal(
            res.headers.get("Content-Security-Policy"),
            expectedCsp(nonce),
            route,
        );
    }
});

test("two requests get different nonces", async () => {
    for (const [route] of HTML_RESPONSES) {
        const first = nonceOf(await app.request(route));
        const second = nonceOf(await app.request(route));
        assert.notEqual(first, second, route);
    }
});

test("every <script> in served HTML carries the header's nonce", async () => {
    for (const [route, rel] of HTML_RESPONSES) {
        const res = await app.request(route);
        const nonce = nonceOf(res);
        const tags = (await res.text()).match(SCRIPT_TAG_RE) ?? [];
        const expected = source(rel).match(SCRIPT_TAG_RE) ?? [];
        assert.ok(expected.length > 0, `${rel} has no <script> to check`);
        assert.equal(tags.length, expected.length, route);
        for (const tag of tags) {
            assert.ok(tag.includes(` nonce="${nonce}"`), `${route}: ${tag}`);
        }
    }
});

test("HTML responses are private, no-store", async () => {
    for (const [route] of HTML_RESPONSES) {
        const res = await app.request(route);
        assert.equal(res.headers.get("Cache-Control"), "private, no-store");
        assert.equal(
            res.headers.get("Content-Type"),
            "text/html; charset=utf-8",
        );
    }
});

test("each HTML_PAGES route serves its page with the nonce", async () => {
    for (const [route, rel] of Object.entries(HTML_PAGES)) {
        const res = await app.request(route);
        assert.equal(res.status, 200, route);
        assert.equal(await res.text(), injectNonce(source(rel), nonceOf(res)));
    }
});

test("adding an HTML_PAGES entry adds a page route", async () => {
    assert.equal((await app.request("/extra")).status, 404);
    HTML_PAGES["/extra"] = "index.html";
    try {
        const res = await createSiteApp(files).request("/extra");
        assert.equal(res.status, 200);
        assert.equal(
            await res.text(),
            injectNonce(source("index.html"), nonceOf(res)),
        );
    } finally {
        delete HTML_PAGES["/extra"];
    }
});

test("an unknown path returns the 404 page with the nonce rules", async () => {
    for (const route of ["/nope", "/images/nope.webp", "/server.js", "/.env"]) {
        const res = await app.request(route);
        const nonce = nonceOf(res);
        assert.equal(res.status, 404, route);
        assert.equal(
            res.headers.get("Content-Security-Policy"),
            expectedCsp(nonce),
        );
        assert.equal(res.headers.get("Cache-Control"), "private, no-store");
        assert.equal(
            await res.text(),
            injectNonce(source(NOT_FOUND_HTML), nonce),
        );
    }
});

test("baseline security headers are on every response", async () => {
    const routes = [
        ...HTML_RESPONSES.map(([route]) => route),
        "/healthz",
        ...Object.keys(assets),
    ];
    for (const route of routes) {
        const res = await app.request(route);
        for (const [name, value] of Object.entries(BASELINE)) {
            assert.equal(res.headers.get(name), value, `${route} ${name}`);
        }
    }
});

test("the static asset map holds today's routes, no more, no fewer", () => {
    assert.deepEqual(
        Object.keys(assets).sort(),
        Object.keys(STATIC_HEADERS).sort(),
    );
});

test("static routes keep today's Content-Type and Cache-Control", async () => {
    for (const [route, [type, cache]] of Object.entries(STATIC_HEADERS)) {
        const res = await app.request(route);
        assert.equal(res.status, 200, route);
        assert.equal(res.headers.get("Content-Type"), type, route);
        assert.equal(res.headers.get("Cache-Control"), cache, route);
    }
});

test("sidecars and licences next to the assets are not served", async () => {
    for (const rel of [
        "images/diversif-home.webp.json",
        "fonts/OFL-besley.txt",
    ]) {
        assert.ok(existsSync(path.join(root, rel)), `${rel} is not on disk`);
        assert.equal(files.has(rel), false, rel);
        assert.equal((await app.request(`/${rel}`)).status, 404, rel);
    }
});

test("every static route serves its file", async () => {
    for (const [route, meta] of Object.entries(assets)) {
        const res = await app.request(route);
        assert.equal(res.status, 200, route);
        const body = Buffer.from(await res.arrayBuffer());
        assert.ok(body.equals(files.get(meta.file)), route);
    }
});

test("/healthz answers ok", async () => {
    const res = await app.request("/healthz");
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "ok");
});

test("injectNonce decorates <script> tags and nothing else", () => {
    const html =
        '<script>a</script><script src="/x.js"></script><script\n' +
        'type="module"></script><noscript></noscript><scripty>';
    assert.equal(
        injectNonce(html, "N"),
        '<script nonce="N">a</script><script nonce="N" src="/x.js"></script>' +
            '<script nonce="N"\ntype="module"></script><noscript></noscript>' +
            "<scripty>",
    );
});

test("createSiteApp refuses a missing file", () => {
    const partial = new Map(files);
    partial.delete(NOT_FOUND_HTML);
    assert.throws(() => createSiteApp(partial), /404\.html/);
});

test("boot fails when data.js names a screenshot the map lacks", () => {
    const data = structuredClone(profile.data);
    const project = data.projects.find((p) => p.shots && p.shots.length);
    project.shots[1].src = "/images/missing.webp";
    assert.throws(() => createSiteApp(files, createProfile(data)), {
        message:
            `static asset map lacks /images/missing.webp, named by ` +
            `data.js: projects[${project.id}].shots[1].src`,
    });
});

test("boot fails when styles.css names a font the map lacks", () => {
    const partial = new Map(files);
    assert.ok(partial.delete("fonts/besley-latin.woff2"));
    assert.throws(() => createSiteApp(partial), {
        message:
            "static asset map lacks /fonts/besley-latin.woff2, named by " +
            "styles.css: @font-face",
    });
});

test("boot fails when the map lacks the homepage photo", () => {
    const i = ROOT_FILES.indexOf("photo.png");
    assert.notEqual(i, -1);
    ROOT_FILES.splice(i, 1);
    try {
        assert.throws(() => createSiteApp(files), {
            message:
                "static asset map lacks /photo.png, named by " +
                "app.js: the homepage photo",
        });
    } finally {
        ROOT_FILES.splice(i, 0, "photo.png");
    }
});

test("boot names every file the map lacks", () => {
    const data = structuredClone(profile.data);
    const project = data.projects.find((p) => p.shots && p.shots.length);
    project.shots[0].src = "/images/a.webp";
    project.shots[1].src = "/images/b.webp";
    assert.throws(() => createSiteApp(files, createProfile(data)), {
        message:
            "static asset map lacks " +
            `/images/a.webp, named by data.js: projects[${project.id}].shots[0].src; ` +
            `/images/b.webp, named by data.js: projects[${project.id}].shots[1].src`,
    });
});

test("a file's type sets its route's Content-Type and Cache-Control", () => {
    assert.deepEqual(
        staticAssets(["images/new.webp", "fonts/new.woff2", "images/new.png"]),
        {
            "/fonts/new.woff2": {
                file: "fonts/new.woff2",
                type: "font/woff2",
                cache: "public, max-age=2592000",
            },
            "/images/new.webp": {
                file: "images/new.webp",
                type: "image/webp",
                cache: "public, max-age=86400",
            },
        },
    );
});

test("a root file of no known type fails boot", () => {
    ROOT_FILES.push("notes.md");
    try {
        const extra = new Map(files).set("notes.md", Buffer.from("x"));
        assert.throws(
            () => createSiteApp(extra),
            /no file type for notes\.md in FILE_TYPES/,
        );
    } finally {
        ROOT_FILES.pop();
    }
});
