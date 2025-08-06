#!/bin/bash

echo "🚀 Optimisation VPS 4GB pour Enju..."

# Arrêter les conteneurs
echo "📦 Arrêt des conteneurs..."
docker compose down

# Nettoyer les ressources Docker
echo "🧹 Nettoyage Docker..."
docker system prune -f
docker volume prune -f
docker image prune -f

# Configurer swap si nécessaire (1GB)
if [ ! -f /swapfile ]; then
    echo "💾 Création du swap 1GB..."
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
fi

# Optimiser les paramètres système
echo "⚙️ Optimisation système..."
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
echo "vm.vfs_cache_pressure=50" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Rebuild et redémarrer avec les nouvelles limites
echo "🔄 Rebuild des images optimisées..."
docker compose build --no-cache

echo "🚀 Démarrage optimisé..."
docker compose up -d

echo "✅ Optimisation terminée !"
echo "📊 Vérification mémoire :"
free -h
echo "📦 Status conteneurs :"
docker ps