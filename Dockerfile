# Alt/self-host option — Vercel is the primary deploy target for this app (see
# README/CLAUDE_CLOUDFLARE.MD). The FFmpeg remux piece lives in remux-service/ as a
# separate deployable and is NOT part of this image; set REMUX_SERVICE_URL and
# REMUX_SERVICE_TOKEN at runtime to point this app at wherever that's running.
FROM node:22-bookworm-slim

WORKDIR /app

RUN npm install -g pnpm@11 \
  && apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so this layer only rebuilds when the lockfile changes.
# prisma/ is needed here too — the postinstall `prisma generate` script runs during
# install and requires prisma/schema.prisma to already be present.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate
RUN pnpm exec next build

ENV NODE_ENV=production
EXPOSE 3000

# Applies pending Prisma migrations before every start — safe to run on every boot,
# a no-op when the schema is already up to date.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec next start -p 3000"]
