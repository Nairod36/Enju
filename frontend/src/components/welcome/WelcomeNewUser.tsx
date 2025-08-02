import React, { useState } from "react";
import { useAccount, useSignMessage } from 'wagmi';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Sparkles, MapPin, X, TreePine, User, Edit3, Info } from "lucide-react";
import { DualWalletButton } from '../DualWalletButton';

interface WelcomeNewUserProps {
  onDismiss: () => void;
  userName?: string;
  islandName?: string;
}

export const WelcomeNewUser: React.FC<WelcomeNewUserProps> = ({
  onDismiss,
  userName,
  islandName = "Your First Island",
}) => {
  const { address, isConnected } = useAccount();
  const { signMessage } = useSignMessage();
  const [username, setUsername] = useState('');
  const [isCreatingUsername, setIsCreatingUsername] = useState(false);
  const [showAuthInfo, setShowAuthInfo] = useState(false);

  const handleCreateUsername = async () => {
    if (!username.trim() || !address) return;

    setIsCreatingUsername(true);
    try {
      // Message à signer pour prouver la propriété du wallet
      const message = `Enju - Création de pseudo: ${username.trim()}\\nAdresse: ${address}\\nTimestamp: ${Date.now()}`;
      
      // Signer le message (optionnel mais recommandé)
      const signature = await signMessage({ message });

      // Appeler l'API backend
      const response = await fetch('http://localhost:3001/api/v1/auth/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address,
          signature,
          message,
        }),
      });

      if (response.ok) {
        // Mettre à jour le username
        const updateResponse = await fetch('http://localhost:3001/api/v1/auth/update-username', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address,
            username: username.trim(),
            signature,
            message: `Enju - Mise à jour pseudo: ${username.trim()}\\nAdresse: ${address}\\nTimestamp: ${Date.now()}`,
          }),
        });

        if (updateResponse.ok) {
          alert('Pseudo créé avec succès!');
          setUsername('');
          // Recharger la page pour mettre à jour le statut utilisateur
          window.location.reload();
        } else {
          const error = await updateResponse.json();
          alert(`Erreur: ${error.message || 'Impossible de créer le pseudo'}`);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la création du pseudo:', error);
      alert('Erreur lors de la signature ou de la création du pseudo');
    } finally {
      setIsCreatingUsername(false);
    }
  };

  // Si pas connecté, afficher la connexion wallet
  if (!isConnected) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200">
            <div className="px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <User className="h-6 w-6 text-emerald-600" />
                    Bienvenue sur Enju
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Connectez votre wallet pour commencer votre aventure DeFi
                  </p>
                </div>
                <button
                  onClick={onDismiss}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <DualWalletButton />
            </div>
            
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Info className="h-4 w-4" />
              <span>
                Vous devrez signer 2 fois: une fois pour vous connecter, une fois pour prouver votre identité
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si connecté, afficher la création de pseudo
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit3 className="h-6 w-6 text-emerald-600" />
                  Créer votre pseudo
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Choisissez un nom d'utilisateur unique pour votre profil
                </p>
              </div>
              <button
                onClick={onDismiss}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="space-y-4">
            {/* Pseudo Input */}
            <div className="space-y-2">
              <Label htmlFor="username">Pseudo</Label>
              <Input
                id="username"
                type="text"
                placeholder="Entrez votre pseudo..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border-emerald-200 focus:border-emerald-500"
                minLength={3}
                maxLength={20}
              />
              <p className="text-xs text-gray-500">
                Minimum 3 caractères, doit être unique
              </p>
            </div>

            {/* Create Button */}
            <Button
              onClick={handleCreateUsername}
              disabled={!username.trim() || username.trim().length < 3 || isCreatingUsername}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {isCreatingUsername ? 'Création...' : 'Créer mon pseudo'}
            </Button>

            {/* Auth Info Toggle */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthInfo(!showAuthInfo)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Info className="h-4 w-4 mr-1" />
                Pourquoi 2 signatures ?
              </Button>
            </div>

            {/* Auth Info */}
            {showAuthInfo && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg text-sm text-gray-700">
                <p className="font-medium text-emerald-800 mb-2">Authentification sécurisée :</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>1ère signature</strong> : Connexion à l'application</li>
                  <li>• <strong>2ème signature</strong> : Preuve de propriété du wallet pour créer le pseudo</li>
                  <li>• Cela garantit que seul le propriétaire du wallet peut créer un pseudo</li>
                  <li>• Les signatures sont optionnelles mais recommandées pour la sécurité</li>
                </ul>
              </div>
            )}

            {/* Wallet Address */}
            <div className="text-center text-sm text-gray-500">
              Wallet connecté: <code className="bg-gray-100 px-2 py-1 rounded">{address}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
