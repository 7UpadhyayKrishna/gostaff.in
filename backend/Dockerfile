FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json

RUN npm ci

COPY frontend frontend
COPY backend backend
COPY prisma prisma
COPY prisma.config.ts prisma.config.ts

RUN npm run build --workspace backend

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/frontend/package.json frontend/package.json
COPY --from=builder /app/backend/package.json backend/package.json
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/backend backend
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/prisma.config.ts prisma.config.ts

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "backend"]
