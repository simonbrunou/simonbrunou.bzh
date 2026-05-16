import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Coolify injects COOLIFY_URL=http://<deploy-hostname> per deploy (prod and
// PR previews alike). Traefik terminates TLS in front of us, so rewrite the
// scheme to https. This means each preview deploy's Origin/CSRF gate
// matches its own hostname instead of being stuck on the canonical prod URL.
// Falls back to an explicit ALLOWED_ORIGIN override, then the prod default.
const COOLIFY_URL = process.env.COOLIFY_URL;
const ALLOWED_ORIGIN =
    (COOLIFY_URL && COOLIFY_URL.replace(/^http:/, "https:")) ||
    process.env.ALLOWED_ORIGIN ||
    "https://simonbrunou.bzh";
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const CHROMIUM_PATH =
    process.env.CHROMIUM_PATH || "/usr/bin/chromium-browser";
const TRUST_PROXY = process.env.TRUST_PROXY !== "false"; // default on, Coolify is fronted by Traefik
const SITEVERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PDF_PATH = "/resume/simon-brunou-cv.pdf";

const BASE_CSP =
    "default-src 'self'; " +
    "script-src 'self' https://challenges.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self'; " +
    "frame-src https://challenges.cloudflare.com; " +
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
    "/resume/photo.png": {
        file: "resume/photo.png",
        type: "image/png",
        cache: "public, max-age=604800, s-maxage=2592000, immutable",
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
    "/resume/": "resume/index.html",
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

// In-memory cache of HTML bodies. The nonce changes per request; the
// body bytes don't, so we read once and replace cheaply.
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

// Token-bucket rate limit: RATE_LIMIT requests per RATE_WINDOW_MS per IP.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map();
function rateLimit(ip) {
    const now = Date.now();
    const bucket = rateBuckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
        rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (bucket.count >= RATE_LIMIT) return false;
    bucket.count += 1;
    return true;
}
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
}, RATE_WINDOW_MS).unref();

function clientIp(c) {
    if (TRUST_PROXY) {
        const xff = c.req.header("x-forwarded-for");
        if (xff) return xff.split(",")[0].trim();
        const real = c.req.header("x-real-ip");
        if (real) return real.trim();
    }
    // Fallback: node-server exposes the socket address on the raw request.
    const raw = c.env?.incoming;
    return raw?.socket?.remoteAddress || "unknown";
}

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
app.get("/resume", (c) => c.redirect("/resume/", 301));
app.get("/resume/", (c) => serveHtml(c, HTML_PAGES["/resume/"]));

for (const [route, meta] of Object.entries(STATIC_ASSETS)) {
    app.get(route, (c) => {
        const body = staticCache.get(meta.file);
        if (!body) return c.notFound();
        c.header("Content-Type", meta.type);
        c.header("Cache-Control", meta.cache);
        return c.body(body);
    });
}

app.post(PDF_PATH, async (c) => {
    const requestId = c.req.header("cf-ray") || randomUUID();
    const ip = clientIp(c);

    if (c.req.header("origin") !== ALLOWED_ORIGIN) {
        return c.text("Forbidden", 403);
    }
    const ct = (c.req.header("content-type") || "").toLowerCase();
    if (!ct.startsWith("application/json")) {
        return c.text("Unsupported Media Type", 415);
    }

    if (!rateLimit(ip)) {
        log("pdf_rate_limited", { ip, requestId });
        return new Response("Too Many Requests", {
            status: 429,
            headers: { "Retry-After": "60" },
        });
    }

    let token;
    try {
        const body = await c.req.json();
        token = body.token;
    } catch {
        return c.text("Bad Request", 400);
    }
    if (typeof token !== "string" || !token) {
        return c.text("Bad Request", 400);
    }
    if (!TURNSTILE_SECRET_KEY) {
        log("pdf_misconfigured", { ip, requestId });
        return c.text("Server Misconfigured", 500);
    }

    const verifyForm = new FormData();
    verifyForm.append("secret", TURNSTILE_SECRET_KEY);
    verifyForm.append("response", token);
    verifyForm.append("remoteip", ip);

    let outcome;
    try {
        const verifyRes = await fetch(SITEVERIFY_URL, {
            method: "POST",
            body: verifyForm,
            signal: AbortSignal.timeout(5000),
        });
        outcome = await verifyRes.json();
    } catch (err) {
        log("pdf_siteverify_failed", { ip, requestId, error: String(err) });
        return c.text("Service Unavailable", 503);
    }
    if (!outcome.success) {
        log("pdf_turnstile_rejected", {
            ip,
            requestId,
            codes: outcome["error-codes"],
        });
        return c.text("Forbidden", 403);
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: CHROMIUM_PATH,
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--font-render-hinting=none",
            ],
        });
        const page = await browser.newPage();
        await page.emulateMediaType("print");
        await page.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: "light" },
        ]);

        // Render against the same process so we don't depend on DNS / TLS.
        const internalUrl = `http://127.0.0.1:${PORT}/resume/?pdf=1`;
        await page.goto(internalUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("html[data-render-complete]", {
            timeout: 10_000,
        });

        const pdf = await page.pdf({
            format: "A4",
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
            printBackground: true,
        });
        await page.close();
        log("pdf_generated", { ip, requestId });

        return new Response(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition":
                    'attachment; filename="simon-brunou-cv.pdf"',
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        log("pdf_generation_failed", {
            ip,
            requestId,
            error: err?.message,
            stack: err?.stack,
        });
        return c.text("Internal Error", 500);
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (_) {
                /* best-effort cleanup */
            }
        }
    }
});

app.notFound((c) => serveHtml(c, NOT_FOUND_HTML, 404));

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
    log("server_started", {
        port: info.port,
        host: HOST,
        allowedOrigin: ALLOWED_ORIGIN,
        coolifyUrl: COOLIFY_URL || null,
    });
});

function shutdown(signal) {
    log("server_stopping", { signal });
    process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
