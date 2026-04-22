FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json

# Install deps
RUN npm ci

# ✅ COPY PRISMA FIRST
COPY prisma ./prisma
COPY prisma.config.ts .

# ✅ THEN generate client
RUN npx prisma generate

# Copy rest of code
COPY backend ./backend
COPY backend/tsconfig.json ./backend/tsconfig.json

# Build backend
RUN npm run build --workspace backend


# ---------------- RUNNER ----------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/backend/package.json backend/package.json
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/backend backend
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/prisma.config.ts prisma.config.ts

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "backend"]
