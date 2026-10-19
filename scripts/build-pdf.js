// Build the FR CV PDF from pdf-template/.
//
// Spins up a tiny static server bound to 127.0.0.1 that exposes
// pdf-template/ at /pdf-template/ and the repo-root shared assets
// (data.js, profile.js, photo.png) at their absolute URLs, then drives
// Puppeteer at it. Output: simon-brunou-cv.pdf at the repo root.
//
// Usage: npm run build:pdf
//   Optional env: CHROMIUM_PATH (defaults to /usr/bin/google-chrome-stable
//   then /usr/bin/chromium then /usr/bin/chromium-browser).

import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "simon-brunou-cv.pdf");

// pdf-template/render-outcome.js writes the outcome of the render on <html>:
// data-render-complete, or data-render-error with the reason it failed.
const OUTCOME_SELECTOR = "html[data-render-complete], html[data-render-error]";
const OUTCOME_TIMEOUT_MS = 10_000;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
};

function resolveChromium() {
    if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
    const candidates = [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ];
    for (const c of candidates) if (existsSync(c)) return c;
    throw new Error(
        "No Chromium found. Install one or set CHROMIUM_PATH.",
    );
}

async function serveFile(res, absPath) {
    try {
        const s = await stat(absPath);
        if (!s.isFile()) {
            res.writeHead(404).end();
            return;
        }
        const body = await readFile(absPath);
        res.writeHead(200, {
            "Content-Type": MIME[path.extname(absPath)] || "application/octet-stream",
            "Cache-Control": "no-store",
        });
        res.end(body);
    } catch {
        res.writeHead(404).end();
    }
}

function startStaticServer() {
    return new Promise((resolve) => {
        const server = createServer(async (req, res) => {
            const url = new URL(req.url, "http://127.0.0.1");
            // Strip query so /pdf-template/?foo doesn't bust the lookup.
            let rel = decodeURIComponent(url.pathname);
            if (rel === "/pdf-template/" || rel === "/pdf-template") {
                rel = "/pdf-template/index.html";
            }
            // Block path traversal — only serve files under ROOT.
            const abs = path.normalize(path.join(ROOT, rel));
            if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
                res.writeHead(403).end();
                return;
            }
            await serveFile(res, abs);
        });
        server.listen(0, "127.0.0.1", () => {
            resolve(server);
        });
    });
}

// The reason the render failed, or null once the CV is ready to print.
// pageError resolves with the first uncaught exception in the page. The
// template records those itself, so the pageerror gives the reason only when
// the template recorded no outcome, as with a syntax error in
// render-outcome.js.
async function renderFailure(page, pageError) {
    const outcome = page.waitForSelector(OUTCOME_SELECTOR, { timeout: OUTCOME_TIMEOUT_MS }).then(
        () => null,
        () =>
            `no render outcome after ${OUTCOME_TIMEOUT_MS / 1000} s; ` +
            "did a module in pdf-template/index.html fail to load?",
    );
    const uncaught = pageError.then((err) =>
        err instanceof Error ? `Uncaught ${err.stack}` : `Uncaught ${err}`,
    );
    const fallback = await Promise.race([outcome, uncaught]);
    const recorded = await page.evaluate(() => {
        const root = document.documentElement;
        return {
            complete: root.hasAttribute("data-render-complete"),
            error: root.getAttribute("data-render-error"),
        };
    });
    if (recorded.complete) return null;
    return recorded.error || fallback;
}

async function main() {
    const server = await startStaticServer();
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/pdf-template/`;
    console.log(`build-pdf: rendering ${url}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            executablePath: resolveChromium(),
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
        // Listen before navigating: the shape check of the Profile throws
        // while the modules load, before goto() returns.
        const pageError = new Promise((resolve) => page.once("pageerror", resolve));
        await page.emulateMediaType("print");
        await page.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: "light" },
        ]);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const failure = await renderFailure(page, pageError);
        if (failure) {
            console.error(`build-pdf: render failed: ${failure}`);
            process.exitCode = 1;
            return;
        }
        const pdf = await page.pdf({
            format: "A4",
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
            printBackground: true,
        });
        await writeFile(OUTPUT, pdf);
        console.log(`build-pdf: wrote ${path.relative(ROOT, OUTPUT)} (${pdf.length} bytes)`);
    } finally {
        if (browser) await browser.close().catch(() => {});
        server.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
