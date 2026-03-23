# ──────────────────────────────────────────
# LITE DOCKERFILE (Optimized for STB ARM)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite (Still needed for backend)
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend code
COPY backend/ ./

# 4. Copy PRE-BUILT Frontend (the /dist folder from your laptop)
# Since you just ran 'npm run build' locally, the dist folder exists in frontend/dist
RUN mkdir -p /app/frontend
COPY frontend/dist /app/frontend/dist

# 5. Expose & Start
EXPOSE 3001
CMD ["node", "server.js"]
