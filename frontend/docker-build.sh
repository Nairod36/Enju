#!/bin/bash

# Script pour builder et lancer l'application avec Docker

set -e

echo "🐳 Building Docker image..."
docker build -t unitededfi-frontend .

echo "✅ Image built successfully!"

echo "🚀 Starting container..."
docker run -d \
  --name unitededfi-frontend-container \
  -p 3000:80 \
  --restart unless-stopped \
  unitededfi-frontend

echo "✅ Container started!"
echo "🌐 Application available at: http://localhost:3000"

echo "📋 Useful commands:"
echo "  - View logs: docker logs unitededfi-frontend-container"
echo "  - Stop container: docker stop unitededfi-frontend-container"
echo "  - Remove container: docker rm unitededfi-frontend-container"
