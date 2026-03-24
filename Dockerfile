# ──────────────────────────────────────────
# LITE DOCKERFILE (Ultimate Fresh Sync)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Dependencies (Layered for Speed)
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend Files (Forcing absolute freshness)
# Explicitly copy each folder to ensure no cache misses
COPY backend/server.js ./
COPY backend/db/ ./db/
COPY backend/routes/ ./routes/
COPY backend/services/ ./services/
COPY backend/public/ ./public/

# 4. Start
ENV PORT=1987
EXPOSE 1987

# Use --no-deprecation to clean up console
CMD ["node", "--no-deprecation", "server.js"]
