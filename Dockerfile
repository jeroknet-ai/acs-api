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

# 3. Copy Backend Files
COPY backend/ ./

# 4. Start
ENV PORT=1987
EXPOSE 1987

# Use --no-deprecation to clean up console
CMD ["node", "--no-deprecation", "server.js"]
