# Docker Setup pour UniteDeFi Frontend

## 🐳 Build et Run avec Docker

### Option 1: Configuration rapide avec token 1inch

```bash
# Configurer automatiquement avec votre token 1inch
./setup-1inch-token.sh YOUR_1INCH_DEV_PORTAL_TOKEN
```

### Option 2: Configuration manuelle

```bash
# 1. Éditer nginx.conf et remplacer 'replace_with_your_dev_portal_token' par votre vrai token
# 2. Build et lancer
docker-compose up -d
```

### Option 3: Docker classique

```bash
# Build de l'image
docker build -t unitededfi-frontend .

# Lancement du container
docker run -d -p 3000:80 -p 8080:8080 --name unitededfi-frontend-container unitededfi-frontend
```

## 🌐 Services disponibles

Une fois lancé, les services seront disponibles sur :

- **Application React** : http://localhost:3000
- **Proxy API 1inch** : http://localhost:8080
- **Health Check** : http://localhost:8080/health

## ⚙️ Configuration API 1inch

### Architecture du proxy

```
React App (port 3000) → Nginx Proxy (port 8080) → API 1inch
```

### Avantages du proxy :
- ✅ Résout les problèmes CORS
- ✅ Rate limiting (600 req/min)
- ✅ Gestion centralisée de l'authentification
- ✅ Logs des appels API
- ✅ Cache et optimisations

### Utilisation dans votre code :

```typescript
// Option 1: Via le proxy interne (recommandé en production)
const apiUrl = "http://localhost:8080";

// Option 2: Via le proxy depuis l'app React
const apiUrl = "http://localhost:3000/api/1inch/";

// Le SDK sera configuré automatiquement selon l'environnement
```

## 📋 Commandes utiles

```bash
# Voir les logs de l'application
docker logs unitededfi-frontend

# Voir les logs Nginx (API calls)
docker exec unitededfi-frontend tail -f /var/log/nginx/access.log

# Vérifier le statut du proxy API
curl http://localhost:8080/health

# Tester un appel API via le proxy
curl http://localhost:8080/fusion-plus/orders/active

# Arrêter les services
docker-compose down

# Rebuild complet avec nouveau token
./setup-1inch-token.sh NEW_TOKEN

# Rebuild sans cache
docker-compose build --no-cache
docker-compose up -d
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env` avec vos variables :

```env
VITE_FUSION_AUTH_KEY=your-1inch-api-key
VITE_REOWN_PROJECT_ID=your-reown-project-id
```

### Configuration Nginx

Le fichier `nginx.conf` inclut maintenant :
- ✅ Serveur principal pour l'app React (port 80)
- ✅ Serveur proxy pour l'API 1inch (port 8080)
- ✅ Rate limiting (600 req/min pour clés hackathon)
- ✅ Headers d'authentification automatiques
- ✅ Cache optimisé
- ✅ Compression gzip
- ✅ Logs séparés

### Rate Limiting

La configuration limite à 600 requêtes/minute (limite des clés hackathon 1inch) avec burst de 1000 requêtes.

## 🚀 Production

Pour la production, considérez :

1. **Token sécurisé** : Utilisez des secrets Docker ou variables d'environnement
2. **HTTPS** : Ajoutez des certificats SSL
3. **Domain name** : Remplacez `localhost` par votre domaine
4. **Monitoring** : Ajoutez des métriques et alertes

### Exemple production avec HTTPS

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;
    
    # ... reste de la configuration
}
```

## 🐛 Dépannage

### API 1inch ne répond pas
```bash
# Vérifier le health check
curl http://localhost:8080/health

# Vérifier les logs du proxy
docker logs unitededfi-frontend | grep "api.1inch"
```

### Problèmes de CORS
```bash
# Le proxy devrait résoudre automatiquement les CORS
# Vérifier que vous utilisez bien le proxy :
# ✅ http://localhost:8080/
# ❌ https://api.1inch.dev/ (direct, causera des CORS)
```

### Rate limiting
```bash
# Si vous dépassez 600 req/min, augmentez la limite dans nginx.conf :
# limit_req_zone $binary_remote_addr zone=mylimit:100m rate=1000r/m;
```

### Token invalide
```bash
# Vérifier votre token dans nginx.conf :
grep "Authorization" nginx.conf

# Reconfigurer avec un nouveau token :
./setup-1inch-token.sh NEW_TOKEN
```
