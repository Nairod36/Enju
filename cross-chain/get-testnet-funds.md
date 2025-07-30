# 💰 Obtenir des fonds testnet

## ETH Sepolia Testnet

### Votre adresse ETH: `0x7bebd7Ee41d346BB8E8BD74a8e833230853024A1`

### Faucets ETH Sepolia:

1. **Alchemy Faucet** (Recommandé)
   - URL: https://sepoliafaucet.com/
   - Connectez votre wallet ou collez votre adresse
   - Obtenez 0.5 ETH par jour

2. **Infura Faucet**
   - URL: https://www.infura.io/faucet/sepolia
   - Nécessite un compte Infura (gratuit)
   - 0.5 ETH par jour

3. **QuickNode Faucet**
   - URL: https://faucet.quicknode.com/ethereum/sepolia
   - Connectez votre wallet MetaMask
   - 0.25 ETH par jour

4. **Chainlink Faucet**
   - URL: https://faucets.chain.link/sepolia
   - Connectez wallet ou collez adresse
   - 0.1 ETH par demande

## TRON Shasta Testnet

### ✅ Vous avez déjà: 738.97 TRX

### Pour plus de TRX si nécessaire:
- URL: https://shasta.tronex.io/
- Collez votre adresse TRON
- 10,000 TRX par jour

## Instructions:

1. **Obtenez 0.1-0.5 ETH sur Sepolia** en utilisant un des faucets ci-dessus
2. **Attendez 2-3 minutes** pour que les fonds arrivent
3. **Lancez le test complet**: `npm run test:real full`

## Commandes de test:

```bash
# Vérifier les balances
npm run test:bridge

# Test transaction ETH seulement
npm run test:real eth

# Test transaction TRON seulement  
npm run test:real tron

# Test complet end-to-end (nécessite ETH)
npm run test:real full
```