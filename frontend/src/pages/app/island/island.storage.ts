import { SavedIslandState, IslandGenerationResult, TreeData, ChestData } from './island.types';
import { islandsService } from '../../../services/islands';
import { authService } from '../../../services/auth';

const STORAGE_KEY = 'saved_islands';
const CURRENT_VERSION = '1.0.0';

export class IslandStorageService {
  /**
   * Sauvegarde l'état actuel d'une île
   */
  static async saveIsland(
    seed: number,
    islandData: IslandGenerationResult,
    userTrees: TreeData[],
    chests: ChestData[],
    usedTiles: Set<string>,
    treeCount: number,
    customName?: string
  ): Promise<string> {
    const name = customName || `Île ${new Date().toLocaleDateString()}`;

    // Si l'utilisateur est connecté, sauvegarder dans l'API
    if (authService.isAuthenticated()) {
      try {
        const island = await islandsService.createIsland({
          name,
          seed,
          islandData,
          userTrees,
          chests,
          usedTiles: Array.from(usedTiles),
          treeCount,
          isActive: true
        });
        
        console.log(`✅ Île sauvegardée en ligne: ${name} (ID: ${island.id})`);
        return island.id;
      } catch (error) {
        console.error('❌ Erreur sauvegarde en ligne, fallback localStorage:', error);
        // Fallback sur localStorage en cas d'erreur
      }
    }

    // Fallback localStorage (utilisateur non connecté ou erreur API)
    const id = `island_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const savedState: SavedIslandState = {
      id,
      name,
      seed,
      createdAt: Date.now(),
      lastModified: Date.now(),
      baseIslandData: islandData,
      userTrees,
      chests,
      usedTiles: Array.from(usedTiles),
      treeCount,
      version: CURRENT_VERSION
    };

    const existingSaves = this.getAllSavedIslands();
    existingSaves.push(savedState);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingSaves));
    
    console.log(`✅ Île sauvegardée localement: ${name} (ID: ${id})`);
    return id;
  }

  /**
   * Charge l'état d'une île sauvegardée
   */
  static loadIsland(id: string): SavedIslandState | null {
    const savedIslands = this.getAllSavedIslands();
    const island = savedIslands.find(island => island.id === id);
    
    if (!island) {
      console.warn(`❌ Île non trouvée: ${id}`);
      return null;
    }

    console.log(`✅ Île chargée: ${island.name}`);
    return island;
  }

  /**
   * Met à jour une île existante
   */
  static updateIsland(
    id: string,
    islandData: IslandGenerationResult,
    userTrees: TreeData[],
    chests: ChestData[],
    usedTiles: Set<string>,
    treeCount: number
  ): boolean {
    const savedIslands = this.getAllSavedIslands();
    const islandIndex = savedIslands.findIndex(island => island.id === id);
    
    if (islandIndex === -1) {
      console.warn(`❌ Île non trouvée pour mise à jour: ${id}`);
      return false;
    }

    savedIslands[islandIndex] = {
      ...savedIslands[islandIndex],
      lastModified: Date.now(),
      baseIslandData: islandData,
      userTrees,
      chests,
      usedTiles: Array.from(usedTiles),
      treeCount
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIslands));
    
    console.log(`✅ Île mise à jour: ${savedIslands[islandIndex].name}`);
    return true;
  }

  /**
   * Supprime une île sauvegardée
   */
  static deleteIsland(id: string): boolean {
    const savedIslands = this.getAllSavedIslands();
    const filteredIslands = savedIslands.filter(island => island.id !== id);
    
    if (filteredIslands.length === savedIslands.length) {
      console.warn(`❌ Île non trouvée pour suppression: ${id}`);
      return false;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredIslands));
    
    console.log(`✅ Île supprimée: ${id}`);
    return true;
  }

  /**
   * Récupère toutes les îles sauvegardées
   */
  static async getAllSavedIslands(): Promise<SavedIslandState[]> {
    // Si l'utilisateur est connecté, récupérer depuis l'API
    if (authService.isAuthenticated()) {
      try {
        const islands = await islandsService.getMyIslands();
        return islands.map(island => ({
          id: island.id,
          name: island.name,
          seed: parseInt(island.seed),
          createdAt: new Date(island.createdAt).getTime(),
          lastModified: new Date(island.lastModified).getTime(),
          baseIslandData: island.islandData,
          userTrees: island.userTrees || [],
          chests: island.chests || [],
          usedTiles: island.usedTiles || [],
          treeCount: island.treeCount,
          version: island.version
        }));
      } catch (error) {
        console.error('❌ Erreur lors du chargement des îles depuis l\'API:', error);
        // Fallback sur localStorage
      }
    }

    // Fallback localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      
      const islands = JSON.parse(saved) as SavedIslandState[];
      
      // Vérifier la compatibilité des versions
      return islands.filter(island => {
        if (!island.version || island.version !== CURRENT_VERSION) {
          console.warn(`⚠️ Île avec version incompatible ignorée: ${island.name}`);
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('❌ Erreur lors du chargement des îles:', error);
      return [];
    }
  }

  /**
   * Exporte une île au format JSON
   */
  static exportIsland(id: string): string | null {
    const island = this.loadIsland(id);
    if (!island) return null;
    
    return JSON.stringify(island, null, 2);
  }

  /**
   * Importe une île depuis des données JSON
   */
  static importIsland(jsonData: string, customName?: string): string | null {
    try {
      const islandData = JSON.parse(jsonData) as SavedIslandState;
      
      // Valider les données
      if (!islandData.baseIslandData || !islandData.seed) {
        throw new Error('Données d\'île invalides');
      }

      // Créer un nouvel ID pour éviter les conflits
      const newId = `island_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const name = customName || `${islandData.name} (Importée)`;

      const importedIsland: SavedIslandState = {
        ...islandData,
        id: newId,
        name,
        createdAt: Date.now(),
        lastModified: Date.now(),
        version: CURRENT_VERSION
      };

      const existingSaves = this.getAllSavedIslands();
      existingSaves.push(importedIsland);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingSaves));
      
      console.log(`✅ Île importée: ${name}`);
      return newId;
    } catch (error) {
      console.error('❌ Erreur lors de l\'importation:', error);
      return null;
    }
  }

  /**
   * Nettoie les sauvegardes (supprime les anciennes)
   */
  static cleanupOldSaves(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const savedIslands = this.getAllSavedIslands();
    const now = Date.now();
    
    const filteredIslands = savedIslands.filter(island => {
      const age = now - island.lastModified;
      return age < maxAge;
    });

    if (filteredIslands.length < savedIslands.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredIslands));
      console.log(`🧹 ${savedIslands.length - filteredIslands.length} îles anciennes supprimées`);
    }
  }

  /**
   * Obtient des statistiques sur les sauvegardes
   */
  static getStorageStats(): {
    totalIslands: number;
    storageSize: string;
    oldestIsland: Date | null;
    newestIsland: Date | null;
  } {
    const islands = this.getAllSavedIslands();
    const storageData = localStorage.getItem(STORAGE_KEY) || '';
    
    const dates = islands.map(i => i.lastModified);
    
    return {
      totalIslands: islands.length,
      storageSize: `${(storageData.length / 1024).toFixed(2)} KB`,
      oldestIsland: dates.length > 0 ? new Date(Math.min(...dates)) : null,
      newestIsland: dates.length > 0 ? new Date(Math.max(...dates)) : null
    };
  }
}