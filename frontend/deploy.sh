#!/bin/bash

# deploy.sh - Deployment script with automatic version bump
# Usage: ./deploy.sh [patch|minor|major]
# Default: patch (1.0.1 -> 1.0.2)

set -e

BUMP_TYPE=${1:-patch}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR"
BACKEND_DIR="$SCRIPT_DIR/../Backend"

echo "🚀 Starting deployment with $BUMP_TYPE version bump..."

# Function to increment version
increment_version() {
    local version=$1
    local bump=$2
    
    IFS='.' read -r major minor patch <<< "$version"
    
    case $bump in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Get current version from vite.config.js
CURRENT_VERSION=$(grep "const APP_VERSION" "$FRONTEND_DIR/vite.config.js" | sed "s/.*'\(.*\)'.*/\1/")
echo "📌 Current version: $CURRENT_VERSION"

# Calculate new version
NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$BUMP_TYPE")
echo "📌 New version: $NEW_VERSION"

# Update version in vite.config.js
sed -i "s/const APP_VERSION = '.*'/const APP_VERSION = '$NEW_VERSION'/" "$FRONTEND_DIR/vite.config.js"
echo "✅ Updated vite.config.js"

# Update version in backend app.js
sed -i "s/const APP_VERSION = '.*'/const APP_VERSION = '$NEW_VERSION'/" "$BACKEND_DIR/app.js"
echo "✅ Updated backend app.js"

# Build frontend
echo "🔨 Building frontend..."
cd "$FRONTEND_DIR"
npm run build

# Copy to nginx path
NGINX_PATH="/var/www/market-app"
echo "📦 Deploying to $NGINX_PATH..."
sudo rm -rf "$NGINX_PATH"/*
sudo cp -r dist/* "$NGINX_PATH/"

echo "--- Fixing Permissions ---"
sudo chown -R www-data:www-data "$NGINX_PATH/"

echo "Restarting Nginx & Cloudflared..."
sudo systemctl restart nginx && sudo systemctl restart cloudflared

echo ""
echo "🎉 Deployment complete!"
echo "   Version: $NEW_VERSION"
echo ""
echo "🔔 Users will see 'Update Available' notification within 5 minutes"
echo "   They can click 'Update Now' to force refresh"