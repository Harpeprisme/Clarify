# Build stage
FROM node:20 AS builder
WORKDIR /app

# Install system dependencies
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Install dependencies separately to leverage cache
COPY package*.json ./
RUN npm install

# Copy schema and generate Prisma client BEFORE copying the rest of the code
# This ensures that local files don't overwrite the correct Linux binaries
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Production stage
FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/seed_admin.js ./seed_admin.js

EXPOSE 3001
CMD ["npm", "start"]
