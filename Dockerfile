# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
WORKDIR /app

# Chromium + the fonts puppeteer-core needs to render the CV correctly.
# nss/freetype/harfbuzz are Chromium's runtime deps; ttf-* + font-noto fill in
# the Latin glyph coverage and a sans fallback chain.
RUN apk add --no-cache \
        chromium \
        nss \
        freetype \
        harfbuzz \
        ca-certificates \
        ttf-freefont \
        font-noto \
        font-noto-emoji \
        dumb-init \
    && addgroup -S app && adduser -S app -G app \
    && mkdir -p /home/app/Downloads && chown -R app:app /home/app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    CHROMIUM_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .

# Drop dev / build artefacts that shouldn't ship.
RUN rm -rf .git .github .claude .wrangler README.md Dockerfile .dockerignore .env* \
    && chown -R app:app /app

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
