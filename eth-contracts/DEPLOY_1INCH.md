# 🌉 Déploiement avec 1inch Integration

Ce guide explique comment déployer le CrossChainResolver avec les vrais contrats 1inch via un fork mainnet.

## 🔧 Prérequis

1. **Foundry installé**
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **RPC Mainnet** (optionnel, sinon utilise un RPC public)
   ```bash
   export MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
   ```

## 🚀 Déploiement rapide

### 1. Démarrer le fork mainnet
```bash
# Windows
.\start-1inch-fork.bat

# Linux/Mac  
./start-mainnet-fork.sh
```

### 2. Déployer le contrat
```bash
# Windows
.\deploy-with-1inch.bat

# Linux/Mac
./deploy-with-1inch.sh
```

### 3. Copier l'adresse du contrat
Le script affichera quelque chose comme :
```
📋 Contract Address: 0x1234567890abcdef...
```

### 4. Mettre à jour votre .env
```bash
CROSS_CHAIN_RESOLVER_ADDRESS=0x1234567890abcdef...
ETH_BRIDGE_CONTRACT=0x1234567890abcdef...
```

## ✅ Tests inclus

Le script de déploiement teste automatiquement :

1. **🌐 Network Check** - Vérifie qu'on est sur mainnet/fork
2. **📦 1inch Contracts** - Vérifie que les contrats 1inch existent
3. **💰 Account Balance** - Vérifie que le compte a assez d'ETH
4. **🚀 Deployment** - Déploie le contrat
5. **✅ Verification** - Vérifie que le déploiement a réussi
6. **🧪 Basic Tests** - Teste les fonctions de base

## 🏭 Adresses 1inch utilisées

- **Escrow Factory**: `0x1111111254EEB25477B68fb85Ed929f73A960582`
- **Limit Order Protocol**: `0x1111111254EEB25477B68fb85Ed929f73A960582`

Ces adresses sont les vraies adresses 1inch sur mainnet, disponibles via le fork.

## 🐛 Dépannage

### ❌ "Anvil fork is not running"
Démarrer le fork avec `.\start-1inch-fork.bat`

### ❌ "1inch contracts not found"  
Vérifier que le fork mainnet utilise un bon RPC URL

### ❌ "Insufficient ETH"
Le fork devrait fournir des comptes avec ETH automatiquement

## 🎯 Après le déploiement

1. **Mettre à jour .env** avec l'adresse du contrat
2. **Démarrer le bridge listener** 
3. **Tester ETH → NEAR** et **NEAR → ETH**

Le système utilisera maintenant les vrais escrows 1inch ! 🎉
