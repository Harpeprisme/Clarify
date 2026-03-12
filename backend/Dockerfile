# Build stage
FROM node:20 AS builder
WORKDIR /app

# Install system dependencies
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy dependency files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# prisma generate will run in postinstall
RUN npm install

# Copy source and schema
COPY . .

# Production stage
FROM node:20-slim
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.sh ./start.sh

# Ensure script is executable
RUN chmod +x start.sh

EXPOSE 3001
CMD ["./start.sh"]
