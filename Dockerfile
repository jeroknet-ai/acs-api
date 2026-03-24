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

# 4. Copy PRE-BUILT Frontend ASSETS (Zip for absolute sync)
RUN apk add --no-cache unzip
COPY frontend/dist.zip /dist.zip
RUN ls -lh /dist.zip && unzip /dist.zip -d /public && rm /dist.zip

# 5. Start
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
