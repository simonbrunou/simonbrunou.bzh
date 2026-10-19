import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    HTML_PAGES,
    NOT_FOUND_HTML,
    STATIC_ASSETS,
    createSiteApp,
    injectNonce,
    loadSiteFiles,
} from "../site.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = await loadSiteFiles(root);
const app = createSiteApp(files);
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
    "/render.js": [JS, REVALIDATE],
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
const HTML_RESPONSES = [
    ...Object.entries(HTML_PAGES).map(([route, rel]) => [route, rel, 200]),
    ["/nope", NOT_FOUND_HTML, 404],
];

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

test("page routes come from HTML_PAGES", async () => {
    for (const [route, rel] of Object.entries(HTML_PAGES)) {
        const res = await app.request(route);
        assert.equal(res.status, 200, route);
        assert.equal(await res.text(), injectNonce(source(rel), nonceOf(res)));
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
    for (const route of ["/", "/nope", "/healthz", "/data.js", "/photo.png"]) {
        const res = await app.request(route);
        for (const [name, value] of Object.entries(BASELINE)) {
            assert.equal(res.headers.get(name), value, `${route} ${name}`);
        }
    }
});

test("static routes keep today's Content-Type and Cache-Control", async () => {
    for (const [route, [type, cache]] of Object.entries(STATIC_HEADERS)) {
        assert.ok(route in STATIC_ASSETS, `${route} is no longer served`);
        const res = await app.request(route);
        assert.equal(res.status, 200, route);
        assert.equal(res.headers.get("Content-Type"), type, route);
        assert.equal(res.headers.get("Cache-Control"), cache, route);
    }
});

test("every static route serves its file with its declared headers", async () => {
    for (const [route, meta] of Object.entries(STATIC_ASSETS)) {
        const res = await app.request(route);
        assert.equal(res.status, 200, route);
        assert.equal(res.headers.get("Content-Type"), meta.type, route);
        assert.equal(res.headers.get("Cache-Control"), meta.cache, route);
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
