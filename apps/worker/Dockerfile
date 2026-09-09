# Build from the REPOSITORY ROOT as context, not from apps/worker:
#
#   docker build -f apps/worker/Dockerfile .
#
# The worker is a workspace package and imports `@ourfilm/shared` from
# packages/, so the lockfile and both package manifests have to be visible.
# On Railway: Root Directory `.`, Dockerfile Path `apps/worker/Dockerfile`.
FROM node:24-alpine

# Match `packageManager` in the root package.json; corepack pins the version.
RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

# Manifests first, so dependency layers are cached across source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter worker...

COPY apps/worker apps/worker
COPY packages/shared packages/shared

WORKDIR /app/apps/worker
ENV NODE_ENV=production
CMD ["pnpm", "start"]
