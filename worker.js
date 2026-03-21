import puppeteer from "@cloudflare/puppeteer";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname !== "/resume/simon-brunou-cv.pdf") {
            return env.ASSETS.fetch(request);
        }

        const browser = await puppeteer.launch(env.BROWSER);
        const page = await browser.newPage();

        await page.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: "light" },
        ]);

        const resumeUrl = new URL("/resume/", url.origin);
        await page.goto(resumeUrl.toString(), { waitUntil: "networkidle0" });

        await page.evaluate(() => {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
        });

        const pdf = await page.pdf({
            format: "A4",
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
            printBackground: true,
        });

        await browser.close();

        return new Response(pdf, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition":
                    'attachment; filename="simon-brunou-cv.pdf"',
                "Cache-Control": "public, max-age=3600",
            },
        });
    },
};
