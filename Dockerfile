# ──────────────────────────────────────────
# STAGE 1: Build the React Frontend
# ──────────────────────────────────────────
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first for better caching
COPY frontend/package*.json ./
RUN npm install

# Build the frontend logic
COPY frontend/ ./
# Set to relative path so it communicates seamlessly when served by the same backend container
ENV VITE_API_URL='/' 
RUN npm run build


# ──────────────────────────────────────────
# STAGE 2: Setup the Backend & Serve
# ──────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# [CRITICAL FOR ARM/STB] Install compiler tools required by SQLite3 on Alpine limits
RUN apk add --no-cache python3 make g++ gcc

# Set up Backend dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source code
COPY backend/ ./

# Copy built frontend from Stage 1 into the correct path relative to server.js
RUN mkdir -p /app/frontend
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose backend port
EXPOSE 3001

# Start the unified application
CMD ["node", "server.js"]
