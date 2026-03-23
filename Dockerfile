# ──────────────────────────────────────────
# LITE DOCKERFILE (Optimized for STB ARM - ULTIMATE FIX)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite (Still needed for backend)
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup EVERYTHING in /app (Minimalist Mode)
# We copy backend package.json to /app root
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend code directly to /app root
COPY backend/ ./

# 4. Copy PRE-BUILT Frontend directly to /app/frontend/dist
RUN mkdir -p /app/frontend/dist
COPY frontend/dist /app/frontend/dist

# 5. Connect and Start (Unified Port 1987)
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
