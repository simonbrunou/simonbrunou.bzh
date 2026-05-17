# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache ca-certificates dumb-init \
    && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .

# Drop dev / build artefacts that shouldn't ship.
# pdf-template/ + scripts/ are build-time only — the runtime serves the
# already-built simon-brunou-cv.pdf at the repo root.
RUN rm -rf .git .github .claude .wrangler README.md Dockerfile .dockerignore .env* \
        pdf-template scripts \
    && chown -R app:app /app

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
