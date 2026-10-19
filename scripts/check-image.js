// Checks a running container of the production image from the inside. CI
// lists the files the checkout serves, then pipes this script into the
// container's node, which runs as the image's user:
//
//   SITE_FILES=$(node --input-type=module -e 'import { loadSiteFiles } from
//       "./site.js"; console.log(JSON.stringify([...(await loadSiteFiles(".")).keys()]))')
//   docker exec -i -e SITE_FILES="$SITE_FILES" <container> \
//       node --input-type=module - < scripts/check-image.js
//
// It fails when a route answers with the wrong status, when the files under
// /app (node_modules aside) differ from what the server needs (server.js,
// site.js, package.json and every file the checkout serves), when the server
// runs as root, or when it could change anything under /app.
import { access, constants, readdir } from "node:fs/promises";
import path from "node:path";
// Absolute: code read from stdin resolves relative imports against the cwd.
import { HTML_PAGES, staticAssets } from "/app/site.js";

const APP_DIR = "/app";
const ORIGIN = "http://127.0.0.1:3000";
const failures = [];

// The pages, ROOT_FILES, and every image and font the checkout serves. They
// come from the checkout, not from /app, so a file the image lacks shows up.
if (!process.env.SITE_FILES) {
    console.error("SITE_FILES is not set; see the usage at the top");
    process.exit(1);
}
const siteFiles = JSON.parse(process.env.SITE_FILES);

const routes = [
    ["/healthz", 200],
    ...Object.keys(HTML_PAGES).map((route) => [route, 200]),
    ["/nope", 404],
    ...Object.keys(staticAssets(siteFiles)).map((route) => [route, 200]),
];
for (const [route, expected] of routes) {
    const res = await fetch(ORIGIN + route);
    if (res.status !== expected) {
        failures.push(`GET ${route}: ${res.status}, expected ${expected}`);
    }
}

// Everything under /app except node_modules must be exactly this list.
const allowed = new Set([
    "package.json",
    "server.js",
    "site.js",
    ...siteFiles,
]);
const entries = (
    await readdir(APP_DIR, { recursive: true, withFileTypes: true })
).map((entry) => ({
    rel: path.relative(APP_DIR, path.join(entry.parentPath, entry.name)),
    isDir: entry.isDirectory(),
}));
const shipped = entries
    .filter((e) => !e.isDir && e.rel.split(path.sep)[0] !== "node_modules")
    .map((e) => e.rel);
for (const rel of shipped) {
    if (!allowed.has(rel)) failures.push(`/app/${rel} ships but is not served`);
}
for (const rel of allowed) {
    if (!shipped.includes(rel)) failures.push(`/app/${rel} is missing`);
}

if (process.getuid() === 0) failures.push("the server runs as root");
// Covers /app itself, so the server cannot add files either.
for (const rel of ["", ...entries.map((e) => e.rel)]) {
    try {
        await access(path.join(APP_DIR, rel), constants.W_OK);
        failures.push(`/app/${rel} is writable by the server`);
    } catch (err) {
        if (err.code !== "EACCES") throw err;
    }
}

if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
}
console.log(
    `image ok: ${routes.length} routes, ${shipped.length} files, ` +
        `${entries.length} entries under /app, none writable`,
);
