# ---------------- BUILDER ----------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json

# Install dependencies
RUN npm ci

# Copy Prisma files FIRST
COPY prisma ./prisma
COPY prisma.config.ts .

# Generate Prisma client
RUN npx prisma generate

# Copy backend code
COPY backend ./backend
COPY backend/tsconfig.json ./backend/tsconfig.json

# ✅ Accept build-time env from GitHub Actions
ARG AWS_REGION
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY

# ✅ Make them available during build
ENV AWS_REGION=$AWS_REGION
ENV AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
ENV AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

# Build backend
RUN npm run build --workspace backend


# ---------------- RUNNER ----------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy only required files
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/backend/package.json backend/package.json
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/backend backend
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/prisma.config.ts prisma.config.ts

EXPOSE 3001

# Start backend
CMD ["npm", "run", "start", "--workspace", "backend"]
