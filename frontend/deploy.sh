#!/bin/bash
echo "Building project..."
npm run build
echo "Deploying to Nginx..."
sudo rm -rf /var/www/market-app/*
sudo cp -r dist/* /var/www/market-app/

echo "--- Fixing Permissions ---"
# This prevents the 502 error
sudo chown -R www-data:www-data /var/www/market-app/

echo "Done! Site updated."
