# syntax=docker/dockerfile:1.28@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b

# Both stages start from this one pinned base, so Renovate bumps one digest.
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS base
WORKDIR /app

FROM base AS deps
# No glob on the lockfile: the build fails without it, and `npm ci` fails when
# it disagrees with package.json.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# No `apk add`. The server makes no outbound requests, so it needs no CA
# certificates. No dumb-init either: production runs the container with
# `--init` (AGENTS.md, Deployment). That init reaps orphans, such as those a
# health check command can leave. Without it, node is PID 1: it still stops
# on SIGTERM and SIGINT, but reaps nothing.

# These COPY lines are the allowlist of what ships: server.js, site.js,
# package.json, production node_modules, and every file site.js serves. That
# is HTML_PAGES, NOT_FOUND_HTML and ROOT_FILES by name (site.js also imports
# profile.js, which imports data.js), and the images and fonts by the
# extension ASSET_DIRS gives them, so the *.webp.json sidecars and OFL-*.txt
# licences stay out. A new page or ROOT_FILES entry needs a line here too,
# and a new ASSET_DIRS directory or extension a matching glob; CI runs
# scripts/check-image.js in the image to catch drift.
# The files stay owned by root, so the server cannot change them.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js site.js ./
COPY index.html 404.html data.js profile.js app.js styles.css \
     photo.png favicon.svg simon-brunou-cv.pdf robots.txt sitemap.xml ./
COPY images/*.webp images/
COPY fonts/*.woff2 fonts/

# The base image's unprivileged user.
USER node
EXPOSE 3000
# Coolify replaces this with its own check of the same URL (curl, falling back
# to wget), so busybox wget must stay in the image. 127.0.0.1, not localhost:
# in Alpine localhost resolves to ::1 first, and the server listens on IPv4.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

CMD ["node", "server.js"]
