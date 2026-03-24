# ──────────────────────────────────────────
# LITE DOCKERFILE (Ultimate Flat Structure)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy EVERYTHING from backend (including the pre-placed 'public' folder)
COPY backend/ ./

# 4. Start
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
