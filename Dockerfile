FROM node:18-alpine
WORKDIR /app

# 1. Install compiler tools for ARM SQLite (Still needed for backend)
RUN apk add --no-cache python3 make g++ gcc

# 2. Setup EVERYTHING in /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

# 3. Copy PRE-BUILT Frontend
RUN mkdir -p /app/frontend/dist
COPY frontend/dist /app/frontend/dist

# 4. Expose & Start (Now at 1987 to match everything)
ENV PORT=1987
EXPOSE 1987
CMD ["node", "server.js"]
