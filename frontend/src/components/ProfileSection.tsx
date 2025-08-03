import { useState, useEffect } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Edit3, Save, Info, X } from "lucide-react";

interface UserProfile {
  id: string;
  address: string;
  username: string | null;
  email: string | null;
  createdAt: string;
  activityScore: number;
  level: number;
  experience: number;
  tokenBalance: string;
}

export function ProfileSection() {
  const { address, isConnected } = useAccount();
  const { signMessage } = useSignMessage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAuthInfo, setShowAuthInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger le profil utilisateur
  useEffect(() => {
    if (isConnected && address) {
      loadProfile();
    }
  }, [isConnected, address]);

  const loadProfile = async () => {
    if (!address) return;

    try {
      const response = await fetch("http://localhost:3001/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setNewUsername(data.user.username || "");
      } else {
        // Si pas de token ou expired, essayer de se connecter automatiquement
        await connectWallet();
      }
    } catch (error) {
      console.error("Erreur lors du chargement du profil:", error);
    }
  };

  const connectWallet = async () => {
    if (!address) return;

    try {
      const response = await fetch(
        "http://localhost:3001/api/v1/auth/connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("auth_token", data.token);
        setProfile(data.user);
        setNewUsername(data.user.username || "");
      }
    } catch (error) {
      console.error("Erreur lors de la connexion:", error);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || !address) return;
    if (newUsername.trim() === profile?.username) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // Message à signer pour prouver la propriété du wallet
      const message = `Enju - Modification pseudo: ${newUsername.trim()}\\nAdresse: ${address}\\nTimestamp: ${Date.now()}`;

      // Signer le message (optionnel mais recommandé)
      const signature = await signMessage({ message });

      // Appeler l'API backend
      const response = await fetch(
        "http://localhost:3001/api/v1/auth/update-username",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            address,
            username: newUsername.trim(),
            signature,
            message,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProfile((prev) =>
          prev ? { ...prev, username: data.user.username } : null
        );
        setIsEditing(false);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Impossible de mettre à jour le pseudo");
      }
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour du pseudo:", error);
      if (error.message.includes("User rejected")) {
        setError("Signature annulée par l'utilisateur");
      } else {
        setError("Erreur lors de la signature ou de la mise à jour du pseudo");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setNewUsername(profile?.username || "");
    setError(null);
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">
              Connectez votre wallet pour accéder à votre profil
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Chargement du profil...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Profil principal */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-6 w-6 text-gray-600" />
            Mon Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pseudo */}
          <div className="space-y-2">
            <Label htmlFor="username">Pseudo</Label>
            {isEditing ? (
              <div className="space-y-2">
                <Input
                  id="username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="border-emerald-200 focus:border-emerald-500"
                  minLength={3}
                  maxLength={20}
                  placeholder="Entrez votre nouveau pseudo..."
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateUsername}
                    disabled={
                      !newUsername.trim() ||
                      newUsername.trim().length < 3 ||
                      isUpdating
                    }
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {isUpdating ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                  <Button
                    onClick={cancelEdit}
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium">
                  {profile.username || "Aucun pseudo défini"}
                </span>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="ghost"
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              </div>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Informations du profil */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <Label className="text-slate-500">Niveau</Label>
              <p className="font-medium">{profile.level}</p>
            </div>
            <div>
              <Label className="text-slate-500">Expérience</Label>
              <p className="font-medium">{profile.experience} XP</p>
            </div>
            <div>
              <Label className="text-slate-500">Score d'activité</Label>
              <p className="font-medium">{profile.activityScore}</p>
            </div>
            <div>
              <Label className="text-slate-500">Balance token</Label>
              <p className="font-medium">{profile.tokenBalance} REWARD</p>
            </div>
          </div>

          {/* Wallet */}
          <div>
            <Label className="text-slate-500">Wallet</Label>
            <code className="block bg-slate-100 px-3 py-2 rounded text-sm mt-1">
              {profile.address}
            </code>
          </div>

          {/* Info authentification */}
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAuthInfo(!showAuthInfo)}
              className="text-slate-500 hover:text-slate-700"
            >
              <Info className="h-4 w-4 mr-1" />
              Pourquoi signer lors de la modification ?
            </Button>
          </div>

          {showAuthInfo && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg text-sm text-slate-700">
              <p className="font-medium text-emerald-800 mb-2">
                Sécurité renforcée :
              </p>
              <ul className="space-y-1 text-slate-600">
                <li>
                  • La signature prouve que vous êtes bien le propriétaire du
                  wallet
                </li>
                <li>
                  • Cela empêche les modifications non autorisées de votre
                  profil
                </li>
                <li>
                  • La signature est optionnelle mais fortement recommandée
                </li>
                <li>
                  • Votre clé privée reste sécurisée et n'est jamais transmise
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
