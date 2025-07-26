# Fusion+ HTLC Near Contract

Smart contract pour étendre Fusion+ de 1inch au réseau Near Protocol via Hash Time Locked Contracts (HTLC).

## 🎯 Fonctionnalités

- **Cross-chain swaps** ETH ↔ NEAR via HTLC
- **Timelock sécurisé** avec délai d'expiration
- **Hash-locked** avec révélation de secret
- **Remboursement automatique** après expiration
- **Frais configurables** pour le protocole
- **Événements** pour suivi off-chain

## 🏗️ Structure du Swap

```rust
pub struct HTLCSwap {
    pub sender: AccountId,        // Initiateur du swap
    pub receiver: AccountId,      // Destinataire 
    pub amount: U128,            // Montant en NEAR
    pub hashlock: String,        // Hash du secret (SHA256)
    pub timelock: u64,           // Timestamp d'expiration
    pub secret: Option<String>,   // Secret révélé
    pub is_claimed: bool,        // Swap récupéré
    pub is_refunded: bool,       // Swap remboursé
    pub eth_tx_hash: Option<String>, // Référence tx Ethereum
}
```

## 📋 Méthodes Principales

### `initiate_swap`
Initie un nouveau swap HTLC
```bash
near call CONTRACT_ID initiate_swap '{
    "receiver": "alice.testnet",
    "hashlock": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    "timelock": 1640995200000000000,
    "eth_tx_hash": "0x123..."
}' --accountId bob.testnet --amount 1
```

### `claim_swap`
Récupère les fonds en révélant le secret
```bash
near call CONTRACT_ID claim_swap '{
    "swap_id": "abc123...",
    "secret": "hello"
}' --accountId alice.testnet
```

### `refund_swap`
Rembourse après expiration du timelock
```bash
near call CONTRACT_ID refund_swap '{
    "swap_id": "abc123..."
}' --accountId bob.testnet
```

### `get_swap`
Consulte les détails d'un swap
```bash
near view CONTRACT_ID get_swap '{
    "swap_id": "abc123..."
}'
```

## 🚀 Déploiement

### Prérequis
```bash
# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Installer Near CLI
npm install -g near-cli

# Se connecter à Near testnet
near login
```

### Build et Deploy
```bash
# Builder le contrat
./build.sh

# Déployer sur testnet
./deploy.sh

# Ou manuellement:
near deploy --wasmFile res/fusion_htlc.wasm --accountId your-contract.testnet
near call your-contract.testnet new '{"owner": "your-contract.testnet"}' --accountId your-contract.testnet
```

## 🧪 Tests

```bash
# Lancer les tests unitaires
cargo test

# Test d'intégration
near call CONTRACT_ID initiate_swap '{"receiver":"test.testnet","hashlock":"hash","timelock":9999999999999999999}' --accountId alice.testnet --amount 1
```

## 🔗 Intégration Fusion+

Ce contrat s'intègre avec le système Fusion+ via :

1. **Relayer off-chain** qui écoute les événements Ethereum
2. **API backend** pour synchronisation des états
3. **Frontend React** pour interface utilisateur

### Flow ETH → NEAR
1. Utilisateur initie swap sur Ethereum (Fusion+)
2. Relayer détecte l'événement et appelle `initiate_swap` sur Near
3. Utilisateur révèle le secret sur Near via `claim_swap`
4. Relayer utilise le secret pour finaliser sur Ethereum

### Flow NEAR → ETH  
1. Utilisateur initie swap sur Near via `initiate_swap`
2. Relayer détecte et crée HTLC correspondant sur Ethereum
3. Utilisateur révèle secret sur Ethereum
4. Relayer finalise sur Near avec `claim_swap`

## 📊 Événements

Le contrat émet des événements pour le suivi :
- `SwapInitiatedEvent`
- `SwapClaimedEvent` 
- `SwapRefundedEvent`

## 🔐 Sécurité

- **Hashlock**: SHA256 du secret
- **Timelock**: Protection contre blocage permanent
- **Access control**: Seuls sender/receiver autorisés
- **Reentrancy**: Protection via état immutable
- **Validation**: Vérification de tous les paramètres