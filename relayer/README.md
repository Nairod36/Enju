# Fusion Relayer

Relayer pour coordonner les échanges cross-chain entre Ethereum et NEAR via 1inch Fusion+.

## Fonctionnalités

- 🔍 **Monitoring Ethereum** : Surveille les événements Fusion+ sur Ethereum
- ⚡ **Exécution NEAR** : Déclenche les actions correspondantes sur NEAR Protocol
- 🔄 **Communication bidirectionnelle** : Gère les swaps dans les deux sens
- 📦 **Resolver off-chain** : Valide et résout les swaps avec conditions personnalisées
- 🔐 **Validation de signatures** : Authentification cryptographique des demandes
- 🛡️ **Protection anti-replay** : Système de nonces pour éviter les attaques
- 📊 **Logging avancé** : Suivi détaillé de tous les événements
- 🛡️ **Gestion d'erreurs** : Reprise automatique en cas d'échec
- 🌐 **API REST** : Interface HTTP pour les résolutions de swaps

## Architecture

```
Ethereum (Fusion+) ←→ Relayer ←→ NEAR (HTLC Contract)
                        ↓
                   Resolver API
                 (Validation + Execution)
```

Le relayer :
1. Surveille les événements Fusion+ sur Ethereum
2. Crée les HTLC correspondants sur NEAR
3. Surveille les événements NEAR pour les actions de retour
4. **Expose une API resolver pour valider et exécuter les claims**

## Installation

```bash
cd relayer
npm install
```

## Configuration

Copiez `.env.example` vers `.env` et configurez :

```bash
cp .env.example .env
```

Variables requises :
- `ETHEREUM_RPC_URL` : URL RPC Ethereum (Alchemy, Infura, etc.)
- `PRIVATE_KEY` : Clé privée pour signer les transactions
- `NEAR_ACCOUNT_ID` : Compte NEAR pour exécuter les transactions
- `NEAR_CONTRACT_ID` : Adresse du contrat HTLC sur NEAR
- `FUSION_AUTH_KEY` : Clé d'authentification 1inch Fusion+
- `RESOLVER_PORT` : Port pour l'API resolver (défaut: 3001)

## Utilisation

### Développement
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Surveillance
```bash
npm run watch
```

## Logs

Les logs sont sauvegardés dans `relayer.log` et affichés dans la console.

Niveaux de log :
- `error` : Erreurs critiques
- `warn` : Avertissements
- `info` : Informations générales
- `debug` : Détails de débogage

## Sécurité

⚠️ **Important** :
- Ne jamais commiter les clés privées
- Utiliser des variables d'environnement pour les secrets
- Mettre en place une rotation des clés régulière
- Surveiller les logs pour détecter les activités suspectes

## Monitoring

Le relayer expose des métriques de santé :
- Statut de connexion Ethereum/NEAR
- Nombre d'événements traités
- Temps de réponse moyen
- Erreurs récentes

## Dépannage

### Erreurs courantes

1. **Connexion Ethereum échouée**
   - Vérifier l'URL RPC
   - Vérifier la connectivité réseau

2. **Compte NEAR non trouvé**
   - Vérifier `NEAR_ACCOUNT_ID`
   - S'assurer que le compte existe sur le réseau configuré

3. **Contrat NEAR non accessible**
   - Vérifier `NEAR_CONTRACT_ID`
   - S'assurer que le contrat est déployé

## Développement

### Structure du projet
```
src/
├── config/         # Configuration
├── services/       # Services principaux
│   ├── ethereum-monitor.ts  # Monitoring Ethereum
│   └── near-executor.ts     # Exécuteur NEAR
├── types/          # Définitions TypeScript
└── index.ts        # Point d'entrée
```

### Tests
```bash
npm test
```

### Lint
```bash
npm run lint
```

## API Resolver

Le relayer expose une API REST pour résoudre les swaps :

### Endpoints

#### `POST /resolve`
Résout un swap avec validation complète :

```json
{
  "swapId": "swap_123",
  "secret": "mon_secret",
  "claimAmount": "1000000000000000000000000",
  "claimer": "0x742d35Cc6334C7532532532",
  "signature": "0x...",
  "timestamp": 1640995200000,
  "nonce": "unique_nonce_123"
}
```

#### `GET /swap/:id`
Récupère le statut d'un swap

#### `GET /health`
Health check de l'API

#### `GET /stats`
Statistiques du resolver

### Utilisation

```typescript
import { ResolverClient } from './src/examples/resolver-client';

const client = new ResolverClient('http://localhost:3001', privateKey);
await client.resolveSwap(swapId, secret, amount);
```

### Conditions de validation

Le resolver valide automatiquement :
- ✅ **Signature** : Authentification cryptographique
- ✅ **Timelock** : Vérification des délais d'expiration
- ✅ **Montant** : Validation des montants réclamés
- ✅ **Secret** : Correspondance avec le hashlock
- ✅ **Logique métier** : Conditions personnalisées

## Contribuer

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request