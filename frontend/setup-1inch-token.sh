#!/bin/bash

# Script pour configurer le token 1inch dans nginx.conf

set -e

# Vérifier si le token est fourni
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <your_1inch_dev_portal_token>"
    echo "📝 Exemple: $0 bltXi06txZPWLfDVH1Q4MtxB5t4Nzlq3"
    exit 1
fi

TOKEN="$1"
NGINX_CONF="nginx.conf"

# Vérifier si le fichier nginx.conf existe
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Le fichier $NGINX_CONF n'existe pas"
    exit 1
fi

# Remplacer le placeholder par le vrai token
sed -i "s/replace_with_your_dev_portal_token/$TOKEN/g" "$NGINX_CONF"

echo "✅ Token configuré dans $NGINX_CONF"
echo "🔑 Token utilisé: ${TOKEN:0:10}..."

# Nettoyer le cache Docker
echo "🧹 Nettoyage du cache Docker..."
docker system prune -f
docker builder prune -f

# Rebuild et relancer Docker
echo "🐳 Rebuilding Docker image..."
docker-compose build --no-cache

echo "🚀 Lancement du container..."
docker-compose up -d

echo "✅ Configuration terminée!"
echo ""
echo "📋 Services disponibles:"
echo "  - Application React: http://localhost:3000"
echo "  - Proxy API 1inch: http://localhost:8080"
echo "  - Health check: http://localhost:8080/health"
echo ""
echo "🔧 Dans votre application React, utilisez:"
echo "  - URL API: http://localhost:8080/"
echo "  - Ou via proxy: http://localhost:3000/api/1inch/"
