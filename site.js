import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const BASE_CSP =
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self'; " +
    "img-src 'self'; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'; " +
    "object-src 'none'; " +
    "upgrade-insecure-requests";

const BASELINE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security":
        "max-age=63072000; includeSubDomains; preload",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
};

// Every non-HTML route the site serves. A file missing from this map is not
// served: there is no directory traversal.
export const STATIC_ASSETS = {
    "/data.js": {
        file: "data.js",
        type: "application/javascript; charset=utf-8",
        cache: "public, max-age=0, must-revalidate",
    },
    "/render.js": {
        file: "render.js",
        type: "application/javascript; charset=utf-8",
        cache: "public, max-age=0, must-revalidate",
    },
    "/app.js": {
        file: "app.js",
        type: "application/javascript; charset=utf-8",
        cache: "public, max-age=0, must-revalidate",
    },
    "/styles.css": {
        file: "styles.css",
        type: "text/css; charset=utf-8",
        cache: "public, max-age=0, must-revalidate",
    },
    "/photo.png": {
        file: "photo.png",
        type: "image/png",
        cache: "public, max-age=604800, s-maxage=2592000, immutable",
    },
    "/favicon.svg": {
        file: "favicon.svg",
        type: "image/svg+xml",
        cache: "public, max-age=604800",
    },
    "/images/diversif-home.webp": {
        file: "images/diversif-home.webp",
        type: "image/webp",
        cache: "public, max-age=86400",
    },
    "/images/diversif-allergens.webp": {
        file: "images/diversif-allergens.webp",
        type: "image/webp",
        cache: "public, max-age=86400",
    },
    "/images/cinder-library.webp": {
        file: "images/cinder-library.webp",
        type: "image/webp",
        cache: "public, max-age=86400",
    },
    "/images/cinder-dashboard.webp": {
        file: "images/cinder-dashboard.webp",
        type: "image/webp",
        cache: "public, max-age=86400",
    },
    "/fonts/big-shoulders-display-latin.woff2": {
        file: "fonts/big-shoulders-display-latin.woff2",
        type: "font/woff2",
        cache: "public, max-age=2592000",
    },
    "/fonts/besley-latin.woff2": {
        file: "fonts/besley-latin.woff2",
        type: "font/woff2",
        cache: "public, max-age=2592000",
    },
    "/simon-brunou-cv.pdf": {
        file: "simon-brunou-cv.pdf",
        type: "application/pdf",
        cache: "public, max-age=3600",
    },
    "/robots.txt": {
        file: "robots.txt",
        type: "text/plain; charset=utf-8",
        cache: "public, max-age=3600",
    },
    "/sitemap.xml": {
        file: "sitemap.xml",
        type: "application/xml; charset=utf-8",
        cache: "public, max-age=3600",
    },
};

// HTML pages get a fresh CSP nonce on every response.
export const HTML_PAGES = {
    "/": "index.html",
};
export const NOT_FOUND_HTML = "404.html";

function generateNonce() {
    return randomBytes(16).toString("base64");
}

function cspWithNonce(nonce) {
    return BASE_CSP.replace(
        /script-src ([^;]+)/,
        (_, parts) =>
            `script-src ${parts.trim()} 'nonce-${nonce}' 'strict-dynamic'`,
    );
}

// Match <script when followed by whitespace or '>' so we don't mangle
// unrelated tags that happen to start with "<script".
const SCRIPT_RE = /<script(?=[\s>])/g;
export function injectNonce(html, nonce) {
    return html.replace(SCRIPT_RE, `<script nonce="${nonce}"`);
}

// Paths, relative to the site root, of every file the app serves.
function siteFilePaths() {
    return [
        ...Object.values(HTML_PAGES),
        NOT_FOUND_HTML,
        ...Object.values(STATIC_ASSETS).map((a) => a.file),
    ];
}

export async function loadSiteFiles(root) {
    const entries = await Promise.all(
        siteFilePaths().map(async (rel) => [
            rel,
            await readFile(path.join(root, rel)),
        ]),
    );
    return new Map(entries);
}

// `files` maps each path from siteFilePaths() to its bytes, as
// loadSiteFiles() returns them. The app never touches the filesystem.
export function createSiteApp(files) {
    const missing = siteFilePaths().filter((rel) => !files.has(rel));
    if (missing.length > 0) {
        throw new Error(`site files not loaded: ${missing.join(", ")}`);
    }
    const html = (rel) => files.get(rel).toString("utf8");

    const app = new Hono();

    app.use("*", async (c, next) => {
        await next();
        for (const [k, v] of Object.entries(BASELINE_HEADERS)) {
            if (!c.res.headers.has(k)) c.res.headers.set(k, v);
        }
    });

    app.get("/healthz", (c) => c.text("ok"));

    function serveHtml(c, body, status = 200) {
        const nonce = generateNonce();
        c.header("Content-Security-Policy", cspWithNonce(nonce));
        c.header("Cache-Control", "private, no-store");
        c.header("Content-Type", "text/html; charset=utf-8");
        return c.body(injectNonce(body, nonce), status);
    }

    for (const [route, rel] of Object.entries(HTML_PAGES)) {
        const body = html(rel);
        app.get(route, (c) => serveHtml(c, body));
    }

    for (const [route, meta] of Object.entries(STATIC_ASSETS)) {
        const body = files.get(meta.file);
        app.get(route, (c) => {
            c.header("Content-Type", meta.type);
            c.header("Cache-Control", meta.cache);
            return c.body(body);
        });
    }

    const notFoundBody = html(NOT_FOUND_HTML);
    app.notFound((c) => serveHtml(c, notFoundBody, 404));

    return app;
}
