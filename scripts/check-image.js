// Checks a running container of the production image from the inside. CI
// pipes it into the container's node, which runs as the image's user:
//
//   docker exec -i <container> node --input-type=module - < scripts/check-image.js
//
// It fails when a route answers with the wrong status, when /app holds a file
// other than the Dockerfile's allowlist, or when the server could change
// its own files.
import { access, constants, readdir } from "node:fs/promises";
import path from "node:path";
// Absolute: code read from stdin resolves relative imports against the cwd.
import { HTML_PAGES, NOT_FOUND_HTML, STATIC_ASSETS } from "/app/site.js";

const APP = "/app";
const BASE = "http://127.0.0.1:3000";
const failures = [];

const routes = [
    ["/healthz", 200],
    ...Object.keys(HTML_PAGES).map((route) => [route, 200]),
    ["/nope", 404],
    ...Object.keys(STATIC_ASSETS).map((route) => [route, 200]),
];
for (const [route, expected] of routes) {
    const res = await fetch(BASE + route);
    if (res.status !== expected) {
        failures.push(`GET ${route}: ${res.status}, expected ${expected}`);
    }
}

// Everything under /app except node_modules must be exactly this list.
const allowed = new Set([
    "package.json",
    "server.js",
    "site.js",
    ...Object.values(HTML_PAGES),
    NOT_FOUND_HTML,
    ...Object.values(STATIC_ASSETS).map((asset) => asset.file),
]);
const entries = (
    await readdir(APP, { recursive: true, withFileTypes: true })
).map((entry) => ({
    rel: path.relative(APP, path.join(entry.parentPath, entry.name)),
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
        await access(path.join(APP, rel), constants.W_OK);
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
