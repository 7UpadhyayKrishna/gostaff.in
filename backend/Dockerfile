FROM node:20-alpine AS builder

WORKDIR /app

# install deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
RUN npm ci
RUN npx prisma generate
# copy only required code
COPY backend ./backend
COPY prisma ./prisma
COPY prisma.config.ts .
COPY backend/tsconfig.json ./backend/tsconfig.json

# build backend
RUN npm run build --workspace backend


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# copy only runtime files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "backend"]
