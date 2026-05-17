// Build the FR CV PDF from pdf-template/.
//
// Spins up a tiny static server bound to 127.0.0.1 that exposes
// pdf-template/ at /pdf-template/ and the repo-root shared assets
// (data.js, render.js, photo.png) at their absolute URLs, then drives
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

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
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
        await page.emulateMediaType("print");
        await page.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: "light" },
        ]);
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("html[data-render-complete]", {
            timeout: 10_000,
        });
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
