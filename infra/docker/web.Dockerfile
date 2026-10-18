# syntax=docker/dockerfile:1.7
FROM node:24.22.0-alpine3.24 AS base
RUN npm install -g pnpm@12.14.0 && npm cache clean --force
ENV PNPM_HOME=/pnpm \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=svetly-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @svetly/web...
COPY apps/web apps/web
# Rewrites are resolved at build time, so the internal API address is a build argument.
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
RUN pnpm --filter @svetly/web run build

FROM node:24.22.0-alpine3.24 AS runtime
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ARG API_INTERNAL_URL=http://api:4000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
