FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js built output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Full node_modules needed for tsx + socket.io + mongoose etc.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Custom server files (tsx handles @/ path aliases via tsconfig)
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/server ./src/server
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib
COPY --from=builder --chown=nextjs:nodejs /app/src/models ./src/models
COPY --from=builder --chown=nextjs:nodejs /app/src/types ./src/types
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.server.json ./tsconfig.server.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node_modules/.bin/tsx", "server.ts"]
