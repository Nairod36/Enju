#!/bin/bash

# UniteDeFi Escrow Event Monitor - Setup and Start Script

echo "🚀 Setting up UniteDeFi Escrow Event Monitor..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Copy environment configuration if needed
if [ ! -f .env ]; then
    echo "📄 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration before running!"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🚀 Starting Escrow Event Monitor..."
    echo ""
    echo "Monitor will:"
    echo "  • Check for new escrow events every 30 seconds"
    echo "  • Send events to backend API at $BACKEND_API_URL"
    echo "  • Log to ./logs/combined.log"
    echo ""
    echo "Press Ctrl+C to stop..."
    echo ""
    
    npm start
else
    echo "❌ Build failed! Please check for errors."
    exit 1
fi
