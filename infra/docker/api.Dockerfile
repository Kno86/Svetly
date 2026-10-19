# syntax=docker/dockerfile:1.7
FROM node:24.22.0-alpine3.24 AS base
RUN apk add --no-cache openssl \
 && npm install -g pnpm@12.14.0 \
 && npm cache clean --force
ENV PNPM_HOME=/pnpm \
    CI=true \
    PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=svetly-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @svetly/api...
COPY apps/api apps/api
RUN pnpm --filter @svetly/api run build

# One-shot migration runner: has the Prisma CLI and the migration files.
FROM build AS migrate
WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM build AS deploy
RUN --mount=type=cache,id=svetly-pnpm,target=/pnpm/store \
    pnpm --filter @svetly/api deploy --prod --legacy /out \
 && cp -r apps/api/dist apps/api/prisma /out/

FROM node:24.22.0-alpine3.24 AS runtime
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV NODE_ENV=production \
    GIT_SHA=${GIT_SHA} \
    BUILD_TIME=${BUILD_TIME}
WORKDIR /app
COPY --from=deploy --chown=node:node /out ./
# Locally generated auth secret lives here (named volume); production passes BETTER_AUTH_SECRET instead.
RUN mkdir -p /var/lib/svetly/media && chown -R node:node /var/lib/svetly && chmod 700 /var/lib/svetly
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health/ready >/dev/null || exit 1
CMD ["node", "dist/main.js"]
