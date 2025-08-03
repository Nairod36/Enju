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

  // Load user's islands
  const loadMyIslands = async () => {
    if (!isAuthenticated || hasLoaded) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const userIslands = await islandsService.getMyIslands();
      setIslands(userIslands);
      
      // Find active island
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

  // Load active island
  const loadActiveIsland = async () => {
    if (!isAuthenticated) return;
    
    try {
      const active = await islandsService.getActiveIsland();
      setActiveIsland(active);
    } catch (err) {
      console.error('Error loading active island:', err);
    }
  };

  // Ensure user has an island
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
      
      // Update list locally without reloading
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

  // Create a new island
  const createIsland = async (islandData: CreateIslandRequest): Promise<IslandResponse | null> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to create islands');
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newIsland = await islandsService.createIsland(islandData);
      
      // Reload islands
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

  // Update an island
  const updateIsland = async (id: string, updateData: UpdateIslandRequest): Promise<IslandResponse | null> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to update islands');
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const updatedIsland = await islandsService.updateIsland(id, updateData);
      
      // Update local list
      setIslands(prev => prev.map(island => 
        island.id === id ? updatedIsland : island
      ));
      
      // Update active island if this is it
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

  // Set an island as active
  const setAsActiveIsland = async (id: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('Must be authenticated to set active island');
      return false;
    }

    setIsLoading(true);
    setError(null);
    try {
      const activatedIsland = await islandsService.setActiveIsland(id);
      
      // Update local states
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

  // Delete an island
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
      
      // If it was the active island, remove it
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
      
      // Update local list
      setIslands(prev => prev.map(island => 
        island.id === id ? updatedIsland : island
      ));
      
      // Update active island if this is it
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

  // Load islands on mount if authenticated
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