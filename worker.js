import puppeteer from "@cloudflare/puppeteer";

const ALLOWED_ORIGIN = "https://simonbrunou.bzh";
const PDF_PATH = "/resume/simon-brunou-cv.pdf";
const SITEVERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function log(event, fields) {
    console.log(JSON.stringify({ event, ...fields }));
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname !== PDF_PATH) {
            return env.ASSETS.fetch(request);
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
        }

        if (request.headers.get("Origin") !== ALLOWED_ORIGIN) {
            return new Response("Forbidden", { status: 403 });
        }

        const contentType = (
            request.headers.get("Content-Type") || ""
        ).toLowerCase();
        if (!contentType.startsWith("application/json")) {
            return new Response("Unsupported Media Type", { status: 415 });
        }

        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const requestId =
            request.headers.get("CF-Ray") || crypto.randomUUID();

        const { success: rateOk } = await env.RATE_LIMITER.limit({ key: ip });
        if (!rateOk) {
            log("pdf_rate_limited", { ip, requestId });
            return new Response("Too Many Requests", {
                status: 429,
                headers: { "Retry-After": "60" },
            });
        }

        let token;
        try {
            const body = await request.json();
            token = body.token;
        } catch {
            return new Response("Bad Request", { status: 400 });
        }

        if (typeof token !== "string" || !token) {
            return new Response("Bad Request", { status: 400 });
        }

        if (!env.TURNSTILE_SECRET_KEY) {
            log("pdf_misconfigured", { ip, requestId });
            return new Response("Server Misconfigured", { status: 500 });
        }

        const formData = new FormData();
        formData.append("secret", env.TURNSTILE_SECRET_KEY);
        formData.append("response", token);
        formData.append("remoteip", ip);

        let outcome;
        try {
            const verifyRes = await fetch(SITEVERIFY_URL, {
                method: "POST",
                body: formData,
                signal: AbortSignal.timeout(5000),
            });
            outcome = await verifyRes.json();
        } catch (err) {
            log("pdf_siteverify_failed", {
                ip,
                requestId,
                error: String(err),
            });
            return new Response("Service Unavailable", { status: 503 });
        }

        if (!outcome.success) {
            log("pdf_turnstile_rejected", {
                ip,
                requestId,
                codes: outcome["error-codes"],
            });
            return new Response("Forbidden", { status: 403 });
        }

        let browser;
        try {
            browser = await puppeteer.launch(env.BROWSER);
            const page = await browser.newPage();

            await page.emulateMediaType("print");
            await page.emulateMediaFeatures([
                { name: "prefers-color-scheme", value: "light" },
            ]);

            const resumeUrl = new URL("/resume/?pdf=1", url.origin);
            await page.goto(resumeUrl.toString(), {
                waitUntil: "networkidle2",
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
            return new Response("Internal Error", { status: 500 });
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (_) {
                    /* swallow — best-effort cleanup */
                }
            }
        }
    },
};
