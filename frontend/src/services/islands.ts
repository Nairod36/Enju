import { authService } from './auth';

const API_BASE_URL = 'http://localhost:3001/api/v1';

export interface CreateIslandRequest {
  name: string;
  seed: number;
  islandData: any;
  treeCount?: number;
  isActive?: boolean;
  userTrees?: any[];
  chests?: any[];
  usedTiles?: string[];
}

export interface UpdateIslandRequest {
  name?: string;
  islandData?: any;
  treeCount?: number;
  userTrees?: any[];
  chests?: any[];
  usedTiles?: string[];
}

export type IslandResponse = any;

class IslandsService {
  private getAuthHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async createIsland(islandData: CreateIslandRequest): Promise<IslandResponse> {
    const response = await fetch(`${API_BASE_URL}/islands`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(islandData),
    });

    if (!response.ok) {
      throw new Error('Failed to create island');
    }

    return response.json();
  }

  async getMyIslands(): Promise<IslandResponse[]> {
    const response = await fetch(`${API_BASE_URL}/islands/my`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch islands');
    }

    return response.json();
  }

  async getActiveIsland(): Promise<IslandResponse | null> {
    const response = await fetch(`${API_BASE_URL}/islands/active`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch active island');
    }

    const data = await response.json();
    return data || null;
  }

  async ensureUserHasIsland(): Promise<IslandResponse> {
    const response = await authService.makeAuthenticatedRequest(`${API_BASE_URL}/islands/ensure`);

    if (!response.ok) {
      throw new Error('Failed to ensure user island');
    }

    return response.json();
  }

  async getIslandById(id: string): Promise<IslandResponse> {
    const response = await fetch(`${API_BASE_URL}/islands/${id}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch island');
    }

    return response.json();
  }

  async updateIsland(id: string, updateData: UpdateIslandRequest): Promise<IslandResponse> {
    const response = await fetch(`${API_BASE_URL}/islands/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error('Failed to update island');
    }

    return response.json();
  }

  async setActiveIsland(id: string): Promise<IslandResponse> {
    const response = await fetch(`${API_BASE_URL}/islands/${id}/activate`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to activate island');
    }

    return response.json();
  }

  async deleteIsland(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/islands/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete island');
    }
  }

  async getIslandsBySeed(seed: number): Promise<IslandResponse[]> {
    const response = await fetch(`${API_BASE_URL}/islands/by-seed/${seed}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch islands by seed');
    }

    return response.json();
  }

  async getPublicIslands(page: number = 1, limit: number = 20): Promise<{
    islands: IslandResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/islands/public?page=${page}&limit=${limit}`);

    if (!response.ok) {
      throw new Error('Failed to fetch public islands');
    }

    return response.json();
  }

  async autoSaveIsland(id: string, updateData: UpdateIslandRequest): Promise<IslandResponse> {
    const response = await fetch(`${API_BASE_URL}/islands/${id}/auto-save`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      throw new Error('Failed to auto-save island');
    }

    return response.json();
  }

  // Migration depuis localStorage
  async migrateFromLocalStorage(): Promise<void> {
    try {
      const localData = localStorage.getItem('saved_islands');
      if (!localData) return;

      const savedIslands = JSON.parse(localData);
      console.log(`📦 Found ${savedIslands.length} islands in localStorage, migrating...`);

      for (const island of savedIslands) {
        try {
          const createData: CreateIslandRequest = {
            name: island.name,
            seed: island.seed,
            islandData: island.baseIslandData,
            treeCount: island.treeCount,
            userTrees: island.userTrees,
            chests: island.chests,
            usedTiles: island.usedTiles,
            isActive: false // Première île sera définie comme active après
          };

          await this.createIsland(createData);
          console.log(`✅ Migrated island: ${island.name}`);
        } catch (error) {
          console.error(`❌ Failed to migrate island ${island.name}:`, error);
        }
      }

      // Sauvegarder les données originales avec un suffixe
      localStorage.setItem('saved_islands_backup', localData);
      localStorage.removeItem('saved_islands');

      console.log('🎉 Migration completed! Original data backed up as saved_islands_backup');
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }
}

export const islandsService = new IslandsService();