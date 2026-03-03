FROM node:22-alpine AS builder

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Sao chép file cấu hình workspace + lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Sao chép source chính
COPY apps ./apps
COPY packages ./packages

# Cài dependency và build app Next.js
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter nextjs build

# Đảm bảo static & public được đặt đúng vị trí trong standalone bundle
RUN cp -r apps/nextjs/.next/static apps/nextjs/.next/standalone/apps/nextjs/.next/static && \
    ([ -d apps/nextjs/public ] && cp -r apps/nextjs/public apps/nextjs/.next/standalone/apps/nextjs/public || true)


FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Sao chép standalone bundle đã build từ stage trước
COPY --from=builder /app/apps/nextjs/.next/standalone ./

EXPOSE 3000

CMD ["node", "apps/nextjs/server.js"]

