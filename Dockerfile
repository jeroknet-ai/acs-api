# ──────────────────────────────────────────
# STAGE 1: Build Frontend
# ──────────────────────────────────────────
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ──────────────────────────────────────────
# STAGE 2: Backend + Serve
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

# 3. Copy built frontend from Stage 1 to 'public'
COPY --from=frontend-builder /app/frontend/dist /app/public

# 4. Start
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
