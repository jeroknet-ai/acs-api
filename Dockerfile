# ──────────────────────────────────────────
# LITE DOCKERFILE (Simplified Directory Structure)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite (Still needed for backend)
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Backend Dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend code
COPY backend/ ./

# 4. Copy PRE-BUILT Frontend to a simple 'public' folder
RUN mkdir -p /app/public
COPY frontend/dist/ /app/public/

# 5. Start
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
