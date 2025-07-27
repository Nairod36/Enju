import { useState, useEffect } from 'react';
import { islandsService, IslandResponse, CreateIslandRequest, UpdateIslandRequest } from '../services/islands';
import { useAuthContext } from '../contexts/AuthContext';

export const useIslands = () => {
  const [islands, setIslands] = useState<IslandResponse[]>([]);
  const [activeIsland, setActiveIsland] = useState<IslandResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { isAuthenticated } = useAuthContext();

  // Charger les îles de l'utilisateur
  const loadMyIslands = async () => {
    if (!isAuthenticated || hasLoaded) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const userIslands = await islandsService.getMyIslands();
      setIslands(userIslands);
      
      // Trouver l'île active
      const active = userIslands.find(island => island.isActive);
      setActiveIsland(active || null);
      setHasLoaded(true);
    } catch (err) {
      setError('Failed to load islands');
      console.error('Error loading islands:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger l'île active
  const loadActiveIsland = async () => {
    if (!isAuthenticated) return;
    
    try {
      const active = await islandsService.getActiveIsland();
      setActiveIsland(active);
    } catch (err) {
      console.error('Error loading active island:', err);
    }
  };

  // S'assurer que l'utilisateur a une île
  const ensureUserHasIsland = async (): Promise<IslandResponse | null> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to access island');
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const island = await islandsService.ensureUserHasIsland();
      setActiveIsland(island);
      
      // Mettre à jour la liste localement sans recharger
      setIslands(prev => {
        const exists = prev.find(i => i.id === island.id);
        if (exists) {
          return prev.map(i => i.id === island.id ? island : i);
        }
        return [island, ...prev];
      });
      
      return island;
    } catch (err) {
      setError('Failed to ensure user island');
      console.error('Error ensuring user island:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Créer une nouvelle île
  const createIsland = async (islandData: CreateIslandRequest): Promise<IslandResponse | null> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to create islands');
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newIsland = await islandsService.createIsland(islandData);
      
      // Recharger les îles
      await loadMyIslands();
      
      return newIsland;
    } catch (err) {
      setError('Failed to create island');
      console.error('Error creating island:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Mettre à jour une île
  const updateIsland = async (id: string, updateData: UpdateIslandRequest): Promise<IslandResponse | null> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to update islands');
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const updatedIsland = await islandsService.updateIsland(id, updateData);
      
      // Mettre à jour la liste locale
      setIslands(prev => prev.map(island => 
        island.id === id ? updatedIsland : island
      ));
      
      // Mettre à jour l'île active si c'est celle-ci
      if (activeIsland?.id === id) {
        setActiveIsland(updatedIsland);
      }
      
      return updatedIsland;
    } catch (err) {
      setError('Failed to update island');
      console.error('Error updating island:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Définir une île comme active
  const setAsActiveIsland = async (id: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to set active island');
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      const activatedIsland = await islandsService.setActiveIsland(id);
      
      // Mettre à jour les états locaux
      setIslands(prev => prev.map(island => ({
        ...island,
        isActive: island.id === id
      })));
      setActiveIsland(activatedIsland);
      
      return true;
    } catch (err) {
      setError('Failed to activate island');
      console.error('Error activating island:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Supprimer une île
  const deleteIsland = async (id: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to delete islands');
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      await islandsService.deleteIsland(id);
      
      // Retirer de la liste locale
      setIslands(prev => prev.filter(island => island.id !== id));
      
      // Si c'était l'île active, la retirer
      if (activeIsland?.id === id) {
        setActiveIsland(null);
      }
      
      return true;
    } catch (err) {
      setError('Failed to delete island');
      console.error('Error deleting island:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save des modifications
  const autoSaveIsland = async (id: string, updateData: UpdateIslandRequest): Promise<IslandResponse | null> => {
    if (!isAuthenticated) {
      console.warn('Must be authenticated to auto-save islands');
      return null;
    }

    try {
      const updatedIsland = await islandsService.autoSaveIsland(id, updateData);
      
      // Mettre à jour la liste locale
      setIslands(prev => prev.map(island => 
        island.id === id ? updatedIsland : island
      ));
      
      // Mettre à jour l'île active si c'est celle-ci
      if (activeIsland?.id === id) {
        setActiveIsland(updatedIsland);
      }
      
      return updatedIsland;
    } catch (err) {
      console.error('Error auto-saving island:', err);
      return null;
    }
  };

  // Migrer depuis localStorage
  const migrateFromLocalStorage = async (): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to migrate islands');
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      await islandsService.migrateFromLocalStorage();
      await loadMyIslands();
      return true;
    } catch (err) {
      setError('Failed to migrate islands');
      console.error('Error migrating islands:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Charger les îles au montage si authentifié
  useEffect(() => {
    if (isAuthenticated && !hasLoaded) {
      loadMyIslands();
    } else if (!isAuthenticated) {
      setIslands([]);
      setActiveIsland(null);
      setHasLoaded(false);
    }
  }, [isAuthenticated, hasLoaded]);

  return {
    islands,
    activeIsland,
    isLoading,
    error,
    loadMyIslands,
    loadActiveIsland,
    ensureUserHasIsland,
    createIsland,
    updateIsland,
    autoSaveIsland,
    setAsActiveIsland,
    deleteIsland,
    migrateFromLocalStorage,
    clearError: () => setError(null)
  };
};