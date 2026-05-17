import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const BASE_CSP =
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
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

const STATIC_ASSETS = {
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

const HTML_PAGES = {
    "/": "index.html",
};
const NOT_FOUND_HTML = "404.html";

function log(event, fields) {
    console.log(
        JSON.stringify({ event, ts: new Date().toISOString(), ...fields }),
    );
}

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
function injectNonce(html, nonce) {
    return html.replace(SCRIPT_RE, `<script nonce="${nonce}"`);
}

const htmlCache = new Map();
async function loadHtml(rel) {
    const abs = path.join(__dirname, rel);
    const body = await readFile(abs, "utf8");
    htmlCache.set(rel, body);
    return body;
}

async function loadStatic(rel) {
    const abs = path.join(__dirname, rel);
    return readFile(abs);
}
const staticCache = new Map();

await Promise.all([
    ...Object.values(HTML_PAGES).map((p) => loadHtml(p)),
    loadHtml(NOT_FOUND_HTML),
    ...Object.values(STATIC_ASSETS).map(async (a) => {
        staticCache.set(a.file, await loadStatic(a.file));
    }),
]);

const app = new Hono();

app.use("*", async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(BASELINE_HEADERS)) {
        if (!c.res.headers.has(k)) c.res.headers.set(k, v);
    }
});

app.get("/healthz", (c) => c.text("ok"));

async function serveHtml(c, rel, status = 200) {
    const body = htmlCache.get(rel) || (await loadHtml(rel));
    const nonce = generateNonce();
    c.header("Content-Security-Policy", cspWithNonce(nonce));
    c.header("Cache-Control", "private, no-store");
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(injectNonce(body, nonce), status);
}

app.get("/", (c) => serveHtml(c, HTML_PAGES["/"]));

for (const [route, meta] of Object.entries(STATIC_ASSETS)) {
    app.get(route, (c) => {
        const body = staticCache.get(meta.file);
        if (!body) return c.notFound();
        c.header("Content-Type", meta.type);
        c.header("Cache-Control", meta.cache);
        return c.body(body);
    });
}

app.notFound((c) => serveHtml(c, NOT_FOUND_HTML, 404));

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
    log("server_started", { port: info.port, host: HOST });
});

function shutdown(signal) {
    log("server_stopping", { signal });
    process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
