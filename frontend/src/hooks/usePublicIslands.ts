import { useState, useEffect } from 'react';
import { islandsService } from '../services/islands';

export interface PublicIslandData {
  id: string;
  name: string;
  seed: string;
  islandData?: any; // Island structure data (includes enlargements)
  totalTrees: number;
  chests?: any[];
  createdAt: string;
  lastModified: string;
  owner?: {
    username: string;
    walletAddress: string;
  };
}

export const usePublicIslands = () => {
  const [islands, setIslands] = useState<PublicIslandData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPublicIslands = async (page: number = 1, limit: number = 20) => {
    setLoading(true);
    setError(null);
    try {
      const response = await islandsService.getPublicIslands(page, limit);
      
      if (response && response.islands) {
        setIslands(response.islands as PublicIslandData[]);
      } else {
        setIslands([]);
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load public islands';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refreshIslands = () => {
    loadPublicIslands();
  };

  useEffect(() => {
    loadPublicIslands();
  }, []);

  return {
    islands,
    loading,
    error,
    loadPublicIslands,
    refreshIslands,
    clearError: () => setError(null)
  };
};
