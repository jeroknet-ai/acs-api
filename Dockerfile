# ──────────────────────────────────────────
# MULTI-STAGE DOCKERFILE (Frontend + Backend)
# ──────────────────────────────────────────

# Stage 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Final Image
FROM node:20-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Backend Dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend Files
COPY backend/ ./

# 4. Copy Built Frontend from Stage 1 to Backend Public
COPY --from=builder /app/frontend/dist ./public

# 5. Start
ENV NODE_ENV=production
ENV PORT=1987
EXPOSE 1987

# Use --no-deprecation to clean up console
CMD ["node", "--no-deprecation", "server.js"]
