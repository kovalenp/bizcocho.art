#!/bin/sh
set -e

echo "Running database migrations..."
npx payload migrate

echo "Starting server..."
exec node server.js
