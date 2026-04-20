#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/hrms-demo}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-docker/.env.prod}"
BRANCH="${BRANCH:-main}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Repository not found at $APP_DIR"
  echo "Clone your repository first, then re-run this script."
  exit 1
fi

cd "$APP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  echo "Copy docker/.env.prod.example to $ENV_FILE and set production values."
  exit 1
fi

echo "Deploying branch: $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "Building and starting containers..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo "Running Prisma migrations..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

echo "Deployment complete."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
