#!/bin/bash

# 🗺️ Acme Analytics - Quick Environment Setup
# ============================================================================

echo "🚀 Setting up Acme Analytics environment..."
echo ""

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists!"
    read -p "Do you want to overwrite it? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Create .env.local
cat > .env.local << 'EOF'
# ============================================================================
# MAMNON ANALYTICS - ENVIRONMENT CONFIGURATION
# ============================================================================

# API Configuration
NEXT_PUBLIC_API_URL=https://api-dev.example.com
NEXT_PUBLIC_SOCKET_URL=https://api-dev.example.com

# Google Maps API Key (REQUIRED!)
# Get your key from: https://console.cloud.google.com/apis/credentials
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE

# Authentication
AUTH_SECRET=change-me-to-a-random-secret-string
NEXTAUTH_URL=http://localhost:3000

# Environment
NODE_ENV=development
EOF

echo "✅ .env.local file created!"
echo ""
echo "⚠️  IMPORTANT: Update the following in .env.local:"
echo "   1. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY - Add your Google Maps API key"
echo "   2. AUTH_SECRET - Generate a random secret"
echo ""
echo "📚 For detailed setup instructions, see: GOOGLE_MAPS_SETUP.md"
echo ""
echo "🚀 After updating, restart your dev server:"
echo "   pnpm dev"
echo ""

