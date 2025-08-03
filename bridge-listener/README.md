# Bridge Listener Service

Service d'écoute et de résolution pour les bridges cross-chain ETH ↔ NEAR avec intégration 1inch Fusion+.

## 🎯 Fonctionnalités

- **Écoute automatique** des événements ETH et NEAR
- **Résolution cross-chain** automatique des swaps
- **API REST** pour monitoring et contrôle manuel
- **Événements temps réel** via Server-Sent Events
- **Intégration 1inch** via EscrowFactory officielle

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Build
npm run build

# Démarrer
npm start
```

## ⚙️ Configuration

### Variables d'environnement requises :

```env
# Ethereum
ETH_RPC_URL=http://vps-b11044fd.vps.ovh.net/rpc
ETH_BRIDGE_CONTRACT=0x... # Adresse InchDirectBridge
ETH_PRIVATE_KEY=0x... # Clé privée du resolver

# NEAR  
NEAR_NETWORK_ID=testnet
NEAR_CONTRACT_ID=matthias-dev.testnet
NEAR_ACCOUNT_ID=matthias-dev.testnet
NEAR_PRIVATE_KEY=ed25519:... # Clé privée NEAR

# API
PORT=3001
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

### Bridges
```
GET /bridges          # Tous les bridges
GET /bridges/active   # Bridges actifs
GET /bridges/:id      # Bridge spécifique
```

### Actions manuelles
```
POST /bridges/initiate     # Initier un bridge
POST /bridges/:id/complete # Compléter un bridge
```

### Événements temps réel
```
GET /events  # Server-Sent Events
```

## 🔄 Flow de bridge ETH → NEAR

1. **Détection** : Écoute `EscrowCreated` sur InchDirectBridge
2. **Création NEAR** : Crée automatiquement le HTLC NEAR correspondant
3. **Résolution** : Surveille la révélation du secret
4. **Completion** : Finalise automatiquement les deux côtés

## 🛠️ Développement

```bash
# Mode développement avec hot reload
npm run dev

# Watcher pour les changements
npm run watch
```

## 📊 Monitoring

Le service expose plusieurs endpoints de monitoring :

- `/health` - État du service
- `/status` - État détaillé des listeners
- `/bridges` - Historique des bridges
- `/events` - Stream temps réel

## 🔧 Structure

```
src/
├── types/           # Types TypeScript
├── services/        # Services principaux
│   ├── eth-listener.ts      # Écoute Ethereum
│   ├── near-listener.ts     # Écoute NEAR
│   └── bridge-resolver.ts   # Résolution cross-chain
├── api/            # API REST
│   └── server.ts
└── index.ts        # Point d'entrée
```

## 🚨 Important

**Avant de démarrer :**

1. ✅ Contrat NEAR déployé sur `matthias-dev.testnet`
2. ⏳ Remplir `ETH_BRIDGE_CONTRACT` avec l'adresse InchDirectBridge
3. ⏳ Configurer les clés privées ETH/NEAR dans `.env`
4. ⏳ Initialiser le contrat NEAR avec `new()`

**Prêt à tester le bridge 1 ETH → Token NEAR !** 🌉