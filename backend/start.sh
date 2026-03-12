#!/bin/sh

echo "🏗️  Starting Database Migrations..."
npx prisma migrate deploy

echo "👤 Initializing Admin Account..."
node seed_admin.js

echo "🚀 Starting Clarify API..."
npm start
