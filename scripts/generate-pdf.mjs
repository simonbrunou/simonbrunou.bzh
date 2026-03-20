import { chromium } from "playwright";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const MIME = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
};

// Tiny static file server so Playwright can load the resume
const server = createServer(async (req, res) => {
    const url = req.url === "/" ? "/index.html" : req.url;
    const filePath = join(ROOT, url);
    try {
        const data = await readFile(filePath);
        res.writeHead(200, {
            "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
        });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end("Not found");
    }
});

server.listen(0, "127.0.0.1", async () => {
    const port = server.address().port;
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Force light theme for PDF
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`http://127.0.0.1:${port}/resume/`, {
        waitUntil: "networkidle",
    });

    // Force light class in case system prefers dark
    await page.evaluate(() => {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
    });

    await page.pdf({
        path: join(ROOT, "resume", "simon-brunou-cv.pdf"),
        format: "A4",
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        printBackground: true,
    });

    console.log("PDF generated: resume/simon-brunou-cv.pdf");
    await browser.close();
    server.close();
});
