// hooks/useRobustNearWallet.ts
import { useEffect, useState, useCallback } from 'react';
import { useWalletSelector } from '@near-wallet-selector/react-hook';

export const useRobustNearWallet = () => {
    const {
        signedAccountId,
        signIn,
        signOut,
        selector,
        accounts
    } = useWalletSelector();

    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    // Fonction pour nettoyer l'état du wallet
    const cleanupWalletState = useCallback(async () => {
        try {
            // Nettoyer le localStorage des données corrompues
            const keys = Object.keys(localStorage).filter(key =>
                key.includes('meteor-wallet') ||
                key.includes('near-wallet-selector')
            );

            keys.forEach(key => {
                try {
                    const value = localStorage.getItem(key);
                    if (value && value.includes('signer')) {
                        console.log(`🧹 Cleaning corrupted storage key: ${key}`);
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    console.log(`🧹 Removing problematic storage key: ${key}`);
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error("Error cleaning wallet state:", error);
        }
    }, []);

    // Fonction de connexion robuste
    const connectWithRetry = useCallback(async (maxRetries = 2) => {
        if (isConnecting) {
            console.log("Connection already in progress");
            return false;
        }

        setIsConnecting(true);
        setConnectionError(null);

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 NEAR connection attempt ${attempt + 1}/${maxRetries + 1}`);

                // Si déjà connecté, retourner succès
                if (signedAccountId) {
                    console.log("✅ Already connected:", signedAccountId);
                    return true;
                }

                // Si c'est une tentative de retry, nettoyer d'abord l'état
                if (attempt > 0) {
                    console.log("🧹 Cleaning state before retry...");
                    await cleanupWalletState();

                    try {
                        await signOut();
                    } catch (signOutError) {
                        console.log("SignOut during retry failed (expected)");
                    }

                    // Attendre un peu avant de réessayer
                    await new Promise(resolve => setTimeout(resolve, 1000 + (attempt * 1000)));
                }

                // Tentative de connexion
                console.log("🚀 Attempting signIn...");
                await signIn();

                // Attendre que l'utilisateur revienne du wallet
                // La connexion sera confirmée par le changement de signedAccountId
                console.log("⏳ Waiting for user to complete wallet interaction...");
                return true;

            } catch (error) {
                console.error(`❌ Connection attempt ${attempt + 1} failed:`, error);

                const isMeteorError = error?.message?.includes('signer') ||
                    error?.message?.includes('Cannot read properties of undefined') ||
                    error?.message?.includes('reading \'signer\'');

                if (isMeteorError && attempt < maxRetries) {
                    setConnectionError(`Connection failed, retrying... (${attempt + 1}/${maxRetries + 1})`);
                    setRetryCount(attempt + 1);
                    continue;
                } else if (attempt === maxRetries) {
                    // Dernier essai échoué
                    if (isMeteorError) {
                        setConnectionError("Meteor Wallet connection failed. Please refresh the page and try again.");
                    } else {
                        setConnectionError(error?.message || "Connection failed after multiple attempts");
                    }
                    setRetryCount(0);
                    return false;
                }
            }
        }

        return false;
    }, [isConnecting, signedAccountId, signIn, signOut, cleanupWalletState]);

    // Fonction de déconnexion avec nettoyage
    const disconnectWallet = useCallback(async () => {
        try {
            await signOut();
            await cleanupWalletState();
            setConnectionError(null);
            setRetryCount(0);
            console.log("✅ NEAR wallet disconnected and cleaned");
        } catch (error) {
            console.error("Error during disconnect:", error);
            // Forcer le nettoyage même en cas d'erreur
            await cleanupWalletState();
            setConnectionError(null);
        }
    }, [signOut, cleanupWalletState]);

    // Surveillance des changements de connexion
    useEffect(() => {
        if (signedAccountId) {
            console.log("✅ NEAR wallet connected:", signedAccountId);
            setConnectionError(null);
            setIsConnecting(false);
            setRetryCount(0);
        }
    }, [signedAccountId]);

    // Nettoyage automatique des erreurs après reconnexion réussie
    useEffect(() => {
        if (signedAccountId && connectionError) {
            setConnectionError(null);
            setRetryCount(0);
        }
    }, [signedAccountId, connectionError]);

    // Détection et récupération automatique des erreurs de Meteor Wallet
    useEffect(() => {
        const handleMeteorError = (event: ErrorEvent) => {
            if (event.error?.message?.includes('signer') ||
                event.error?.message?.includes('Cannot read properties of undefined')) {

                console.warn('🔧 Auto-detecting Meteor Wallet error');

                if (!isConnecting && !connectionError) {
                    setConnectionError("Meteor Wallet error detected. Click to retry connection.");
                }

                // Empêcher l'affichage de l'erreur dans la console
                event.preventDefault();
            }
        };

        window.addEventListener('error', handleMeteorError);
        return () => window.removeEventListener('error', handleMeteorError);
    }, [isConnecting, connectionError]);

    // Fonction pour forcer une reconnexion (utile pour les boutons retry)
    const forceReconnect = useCallback(async () => {
        console.log("🔄 Force reconnection requested");
        await cleanupWalletState();

        try {
            await signOut();
        } catch (error) {
            console.log("SignOut during force reconnect failed (expected)");
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        return await connectWithRetry(3); // Plus de tentatives pour une reconnexion forcée
    }, [cleanupWalletState, signOut, connectWithRetry]);

    return {
        // État
        accountId: signedAccountId,
        isConnected: !!signedAccountId,
        isConnecting,
        connectionError,
        retryCount,
        accounts,
        selector,

        // Actions
        connect: connectWithRetry,
        disconnect: disconnectWallet,
        forceReconnect,
        clearError: () => setConnectionError(null),

        // Utilitaires
        isMeteorWalletError: connectionError?.includes('Meteor Wallet') ||
            connectionError?.includes('signer') || false,
    };
};