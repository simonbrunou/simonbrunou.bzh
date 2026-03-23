import puppeteer from "@cloudflare/puppeteer";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname !== "/resume/simon-brunou-cv.pdf") {
            return env.ASSETS.fetch(request);
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        // Verify Cloudflare Turnstile token
        let token;
        try {
            const body = await request.json();
            token = body.token;
        } catch {
            return new Response("Bad Request", { status: 400 });
        }

        if (!token) {
            return new Response("Bad Request", { status: 400 });
        }

        const formData = new FormData();
        formData.append("secret", env.TURNSTILE_SECRET_KEY);
        formData.append("response", token);
        const ip = request.headers.get("CF-Connecting-IP");
        if (ip) formData.append("remoteip", ip);

        const verifyRes = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            { method: "POST", body: formData }
        );
        const outcome = await verifyRes.json();

        if (!outcome.success) {
            return new Response("Forbidden", { status: 403 });
        }

        const browser = await puppeteer.launch(env.BROWSER);
        const page = await browser.newPage();

        await page.emulateMediaFeatures([
            { name: "prefers-color-scheme", value: "light" },
        ]);

        const resumeUrl = new URL("/resume/?pdf=1", url.origin);
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
                "Cache-Control": "no-store",
            },
        });
    },
};
