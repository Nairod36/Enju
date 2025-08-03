import { useState, useEffect } from 'react';

export interface AnimalNFT {
  id: string;
  name: string;
  animalTypeId: number;
  animalTypeName: string;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  level: number;
  experience: number;
  strength: number;
  agility: number;
  intelligence: number;
  price: string; // Prix en RewardTokens
  seller: {
    address: string;
    username?: string;
  };
  isAuction: boolean;
  auctionEndTime?: number;
  currentBid?: string;
  imageUrl?: string;
  listed: boolean;
  listedAt: number;
}

export function useMarketplace() {
  const [nfts, setNfts] = useState<AnimalNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simuler le chargement des données depuis l'API/blockchain
  useEffect(() => {
    const fetchMarketplaceNFTs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Simuler un délai de réseau
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Données mockées pour le développement
        const mockData: AnimalNFT[] = [
          {
            id: "1",
            name: "Thunder",
            animalTypeId: 5,
            animalTypeName: "Tiger",
            rarity: "LEGENDARY",
            level: 15,
            experience: 2450,
            strength: 95,
            agility: 88,
            intelligence: 72,
            price: "150",
            seller: {
              address: "0x742d35Cc6634C0532925a3b8D43C7dE4723c2f6B",
              username: "TigerKing"
            },
            isAuction: false,
            listed: true,
            listedAt: Date.now() - 86400000
          },
          {
            id: "2", 
            name: "Shadow",
            animalTypeId: 6,
            animalTypeName: "Fox",
            rarity: "EPIC",
            level: 12,
            experience: 1890,
            strength: 65,
            agility: 92,
            intelligence: 88,
            price: "75",
            seller: {
              address: "0x8ba1f109551bD432803012645Hac136c4f34c7C2",
              username: "FoxHunter"
            },
            isAuction: true,
            auctionEndTime: Date.now() + 3600000,
            currentBid: "65",
            listed: true,
            listedAt: Date.now() - 43200000
          },
          {
            id: "3",
            name: "Whiskers",
            animalTypeId: 0,
            animalTypeName: "Cat",
            rarity: "COMMON",
            level: 3,
            experience: 120,
            strength: 25,
            agility: 45,
            intelligence: 38,
            price: "15",
            seller: {
              address: "0x1234567890123456789012345678901234567890"
            },
            isAuction: false,
            listed: true,
            listedAt: Date.now() - 172800000
          },
          {
            id: "4",
            name: "Majesty",
            animalTypeId: 7,
            animalTypeName: "Elephant",
            rarity: "RARE",
            level: 8,
            experience: 850,
            strength: 85,
            agility: 45,
            intelligence: 78,
            price: "95",
            seller: {
              address: "0x9876543210987654321098765432109876543210",
              username: "ElephantMaster"
            },
            isAuction: true,
            auctionEndTime: Date.now() + 7200000,
            currentBid: "85",
            listed: true,
            listedAt: Date.now() - 259200000
          },
          {
            id: "5",
            name: "Goldie",
            animalTypeId: 3,
            animalTypeName: "Fish",
            rarity: "UNCOMMON",
            level: 6,
            experience: 420,
            strength: 35,
            agility: 68,
            intelligence: 55,
            price: "25",
            seller: {
              address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
              username: "AquaLord"
            },
            isAuction: false,
            listed: true,
            listedAt: Date.now() - 518400000
          },
          {
            id: "6",
            name: "Ruby",
            animalTypeId: 8,
            animalTypeName: "Dragon",
            rarity: "LEGENDARY",
            level: 25,
            experience: 5200,
            strength: 98,
            agility: 85,
            intelligence: 95,
            price: "500",
            seller: {
              address: "0xfedcbafedcbafedcbafedcbafedcbafedcbafed",
              username: "DragonMaster"
            },
            isAuction: true,
            auctionEndTime: Date.now() + 10800000,
            currentBid: "450",
            listed: true,
            listedAt: Date.now() - 604800000
          }
        ];
        
        setNfts(mockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch marketplace data');
      } finally {
        setLoading(false);
      }
    };

    fetchMarketplaceNFTs();
  }, []);

  const buyNFT = async (nftId: string) => {
    try {
      setLoading(true);
      // Ici, vous intégreriez avec le smart contract
      console.log('Buying NFT:', nftId);
      
      // Simuler l'achat
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retirer le NFT de la liste après achat
      setNfts(prev => prev.filter(nft => nft.id !== nftId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy NFT');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const placeBid = async (nftId: string, bidAmount: string) => {
    try {
      setLoading(true);
      // Ici, vous intégreriez avec le smart contract pour les enchères
      console.log('Placing bid:', nftId, bidAmount);
      
      // Simuler la mise d'enchère
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mettre à jour l'enchère actuelle
      setNfts(prev => prev.map(nft => 
        nft.id === nftId 
          ? { ...nft, currentBid: bidAmount }
          : nft
      ));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refreshMarketplace = () => {
    // Relancer le chargement des données
    setNfts([]);
    setLoading(true);
    setError(null);
    // Le useEffect se rechargera automatiquement
  };

  return {
    nfts,
    loading,
    error,
    buyNFT,
    placeBid,
    refreshMarketplace
  };
}