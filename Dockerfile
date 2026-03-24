# ──────────────────────────────────────────
# LITE DOCKERFILE (Single Stage - Best for ARM STB)
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup Backend Dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# 3. Copy Backend code
COPY backend/ ./

# 4. Copy PRE-BUILT Frontend from laptop to 'public'
# Pastikan folder 'dist' di laptop terisi (npm run build di laptop)
RUN mkdir -p /app/public
COPY frontend/dist/ /app/public/

# 5. Start
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
