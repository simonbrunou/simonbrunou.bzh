import { serve } from "@hono/node-server";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSiteApp, loadSiteFiles } from "./site.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

function log(event, fields) {
    console.log(
        JSON.stringify({ event, ts: new Date().toISOString(), ...fields }),
    );
}

const app = createSiteApp(await loadSiteFiles(__dirname));

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
    log("server_started", { port: info.port, host: HOST });
});

function shutdown(signal) {
    log("server_stopping", { signal });
    process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
