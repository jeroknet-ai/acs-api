# ──────────────────────────────────────────
# LITE DOCKERFILE (Production Alignment)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend code
COPY backend/ ./

# 4. Copy PRE-BUILT Frontend to the root 'public' folder
# This is the most DEFINTIVE way to ensure path consistency
RUN mkdir -p /public
COPY frontend/dist/. /public/

# 5. Start
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
