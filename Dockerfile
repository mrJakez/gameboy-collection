FROM node:22-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Reinstall sharp for linux-musl — host-compiled binaries (macOS/Windows) won't
# work inside Alpine. This adds the correct platform-specific native binary.
RUN npm install --ignore-scripts=false --os=linux --libc=musl --cpu=arm64 sharp

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Python for import script
RUN apk add --no-cache python3

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Sharp native binaries must be copied explicitly — the standalone build doesn't
# bundle platform-specific .node files automatically.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

# Copy import script
COPY --chown=nextjs:nodejs scripts/import_pocket.py ./scripts/import_pocket.py
COPY --chown=nextjs:nodejs scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

# Mount points
RUN mkdir -p /app/data /app/public/library /app/public/cartridges /pocket-data \
    && chown -R nextjs:nodejs /app/data /app/public/library /app/public/cartridges /pocket-data

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/app/scripts/entrypoint.sh"]
