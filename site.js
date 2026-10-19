import { Hono } from "hono";
import { readFile, readdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import siteProfile from "./profile.js";

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

// Files at the site root, each served at /<name>.
export const ROOT_FILES = [
    "data.js",
    "profile.js",
    "app.js",
    "styles.css",
    "photo.png",
    "favicon.svg",
    "simon-brunou-cv.pdf",
    "robots.txt",
    "sitemap.xml",
];

// Directories served whole, one file type each: every images/*.webp and
// fonts/*.woff2 there at boot. Other files in them (the *.webp.json
// provenance sidecars, the OFL-*.txt licences) are not served.
const ASSET_DIRS = {
    images: ".webp",
    fonts: ".woff2",
};

// Content-Type and Cache-Control for each file type the site serves.
const FILE_TYPES = {
    ".js": {
        type: "application/javascript; charset=utf-8",
        cache: "public, max-age=0, must-revalidate",
    },
    ".css": {
        type: "text/css; charset=utf-8",
        cache: "public, max-age=0, must-revalidate",
    },
    ".png": {
        type: "image/png",
        cache: "public, max-age=604800, s-maxage=2592000, immutable",
    },
    ".svg": {
        type: "image/svg+xml",
        cache: "public, max-age=604800",
    },
    ".webp": {
        type: "image/webp",
        cache: "public, max-age=86400",
    },
    ".woff2": {
        type: "font/woff2",
        cache: "public, max-age=2592000",
    },
    ".pdf": {
        type: "application/pdf",
        cache: "public, max-age=3600",
    },
    ".txt": {
        type: "text/plain; charset=utf-8",
        cache: "public, max-age=3600",
    },
    ".xml": {
        type: "application/xml; charset=utf-8",
        cache: "public, max-age=3600",
    },
};

// Whether rel, relative to the site root, is in ROOT_FILES or has the
// extension ASSET_DIRS gives its directory.
function isStaticAsset(rel) {
    if (ROOT_FILES.includes(rel)) return true;
    const dir = path.posix.dirname(rel);
    return (
        Object.hasOwn(ASSET_DIRS, dir) &&
        path.posix.extname(rel) === ASSET_DIRS[dir]
    );
}

// The static asset map, route -> { file, type, cache }, of the given paths
// relative to the site root: every non-HTML route the site serves.
// createSiteApp builds it once at boot from the loaded files, so a request
// never reaches the filesystem: there is no directory traversal.
export function staticAssets(paths) {
    const assets = {};
    for (const rel of [...paths].filter(isStaticAsset).sort()) {
        const ext = path.posix.extname(rel);
        if (!Object.hasOwn(FILE_TYPES, ext)) {
            throw new Error(`no file type for ${rel} in FILE_TYPES`);
        }
        assets[`/${rel}`] = { file: rel, ...FILE_TYPES[ext] };
    }
    return assets;
}

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

// Paths, relative to the site root, of the files the app needs by name.
function requiredFilePaths() {
    return [...Object.values(HTML_PAGES), NOT_FOUND_HTML, ...ROOT_FILES];
}

// Reads the required files, and every file in ASSET_DIRS that the map
// serves.
export async function loadSiteFiles(root) {
    const listed = await Promise.all(
        Object.keys(ASSET_DIRS).map(async (dir) =>
            (await readdir(path.join(root, dir)))
                .map((name) => `${dir}/${name}`)
                .filter(isStaticAsset),
        ),
    );
    const entries = await Promise.all(
        [...requiredFilePaths(), ...listed.flat()].map(async (rel) => [
            rel,
            await readFile(path.join(root, rel)),
        ]),
    );
    return new Map(entries);
}

// The photo app.js puts on the homepage (data.js does not name it), and the
// stylesheet every page links.
const HOMEPAGE_PHOTO = "/photo.png";
const STYLESHEET = "/styles.css";

const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g;
const CSS_URL_RE = /url\(\s*(["']?)([^"')]+)\1\s*\)/g;

// Each route the homepage asks for and the static asset map must hold,
// with what names it: the screenshots in data.js, the photo, the
// stylesheet and its fonts. A route the map lacks reaches the Visitor as
// the 404 page.
function assetReferences(profile, assets, files) {
    const refs = [];
    for (const project of profile.data.projects.filter(profile.isFeatured)) {
        project.shots.forEach((shot, j) => {
            const at = `projects[${project.id}].shots[${j}].src`;
            refs.push([shot.src, `data.js: ${at}`]);
        });
    }
    refs.push([HOMEPAGE_PHOTO, "app.js: the homepage photo"]);
    refs.push([STYLESHEET, "index.html and 404.html"]);
    if (Object.hasOwn(assets, STYLESHEET)) {
        const css = files.get(assets[STYLESHEET].file).toString("utf8");
        for (const [face] of css.matchAll(FONT_FACE_RE)) {
            for (const [, , url] of face.matchAll(CSS_URL_RE)) {
                refs.push([url, "styles.css: @font-face"]);
            }
        }
    }
    return refs;
}

// `files` maps each path from requiredFilePaths() and each listed asset to
// its bytes, as loadSiteFiles() returns them. The app never touches the
// filesystem. `profile` defaults to the Profile of the data.js next to this
// file; tests pass edited ones. Throws when a file the homepage asks for
// has no route.
export function createSiteApp(files, profile = siteProfile) {
    const missing = requiredFilePaths().filter((rel) => !files.has(rel));
    if (missing.length > 0) {
        throw new Error(`site files not loaded: ${missing.join(", ")}`);
    }
    const assets = staticAssets(files.keys());
    const unrouted = assetReferences(profile, assets, files)
        .filter(([route]) => !Object.hasOwn(assets, route))
        .map(([route, by]) => `${route}, named by ${by}`);
    if (unrouted.length > 0) {
        throw new Error(`static asset map lacks ${unrouted.join("; ")}`);
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

    for (const [route, meta] of Object.entries(assets)) {
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
