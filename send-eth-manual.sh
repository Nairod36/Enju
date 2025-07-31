#!/bin/bash

echo "🚨 RECOVERING TRON → ETH Bridge manually..."
echo "📊 TRX received: 1681.229733 TRX"
echo "💱 Converting to: 0.146064383101126183 ETH"
echo "📍 ETH destination: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

# Utilisation de l'API bridge-listener pour déclencher l'envoi ETH
echo "💸 Triggering ETH transfer via bridge-listener API..."

curl -X POST http://localhost:3002/bridges/manual-tron-to-eth \
  -H "Content-Type: application/json" \
  -d '{
    "trxAmount": "1681.229733",
    "ethAmount": "0.146064383101126183",
    "ethRecipient": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "reason": "Manual recovery for missed TRON transactions"
  }' || echo "❌ API endpoint not available"

echo ""
echo "💡 Alternative: Contact admin to manually send 0.146 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"