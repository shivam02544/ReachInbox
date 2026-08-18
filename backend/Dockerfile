# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source files and build
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Stage 2: Runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests and production dependencies
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

# Default command starts the API server.
# The worker container overrides CMD to "npm run worker:prod"
CMD ["npm", "run", "start"]
