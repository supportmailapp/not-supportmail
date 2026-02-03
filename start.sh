#!/bin/bash
set -e

APP_NAME="sm-helper"

echo "Starting deployment..."
echo "Pulling latest changes from Git..."
git fetch && git reset --hard origin/main && git pull origin

echo "Installing dependencies..."
bun install

echo "Building Bot..."
bun run build

echo "Restarting with PM2..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    echo "Reloading application..."
    pm2 restart pm2.config.js --update-env
else
    echo "Starting application..."
    pm2 start pm2.config.js --env production
fi

pm2 save

echo "Deployment complete!"