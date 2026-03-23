# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/
RUN npm ci

# Copy source and build everything
COPY . .
RUN npm run build

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install backend production dependencies only
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci --workspace=packages/backend --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/packages/backend/dist  ./packages/backend/dist
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "packages/backend/dist/index.js"]
