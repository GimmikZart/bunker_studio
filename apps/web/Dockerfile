FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm --filter @bunker-studio/web build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app /app
WORKDIR /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@bunker-studio/web", "start"]
