#!/bin/sh

echo "🏗️  Starting Database Migrations (db push)..."
npx prisma db push --accept-data-loss

if [ "$RESET_DB_ON_START" = "true" ]; then
  echo "⚠️ RESET_DB_ON_START=true : Cleaning database and recreating admin..."
  node src/scripts/reset_db.js
else
  echo "✅ Skipping database reset (RESET_DB_ON_START not set)."
fi

echo "🚀 Starting Clarify API..."
npm start
