import { ethers } from 'ethers';
import { TronClient } from './tron-client';
import { PriceOracle } from './price-oracle';
import { InchFusionTypes } from './types';

export class EthTronResolver {
  private ethProvider: ethers.JsonRpcProvider;
  private tronClient: TronClient;
  private priceOracle: PriceOracle;
  private resolverSigner: ethers.Wallet;
  private isRunning = false;

  // Contrats déployés
  private readonly ETH_BRIDGE_CONTRACT = '0xfde41A17EBfA662867DA7324C0Bf5810623Cb3F8';
  private readonly TRON_BRIDGE_CONTRACT = 'TA879tNjuFCd8w57V3BHNhsshehKn1Ks86';

  constructor(config: {
    ethRpcUrl: string;
    ethPrivateKey: string;
    tronConfig: InchFusionTypes.Config['tron'];
  }) {
    this.ethProvider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    this.resolverSigner = new ethers.Wallet(config.ethPrivateKey, this.ethProvider);
    this.tronClient = new TronClient(config.tronConfig);
    this.priceOracle = new PriceOracle();
  }

  /**
   * Démarrer le resolver
   */
  async start(): Promise<void> {
    console.log('🚀 Starting ETH ↔ TRON Resolver...');
    
    this.isRunning = true;
    
    // Démarrer les watchers en parallèle
    await Promise.all([
      this.watchEthToTronSwaps(),
      this.watchTronToEthSwaps()
    ]);
  }

  /**
   * Arrêter le resolver
   */
  stop(): void {
    console.log('🛑 Stopping ETH ↔ TRON Resolver...');
    this.isRunning = false;
  }

  /**
   * Watcher ETH → TRON swaps
   */
  private async watchEthToTronSwaps(): Promise<void> {
    console.log('👀 Watching ETH → TRON swaps...');

    const bridgeContract = new ethers.Contract(
      this.ETH_BRIDGE_CONTRACT,
      [
        'event SwapCreated(bytes32 indexed swapId, address indexed user, uint256 amount, bytes32 hashlock, string targetChain)',
        'function completeSwap(bytes32 swapId, bytes32 secret) external',
        'function getSwap(bytes32 swapId) external view returns (address user, uint256 amount, bytes32 hashlock, string memory targetAccount, bool completed, bool refunded, uint256 timelock)'
      ],
      this.resolverSigner
    );

    // Écouter les événements SwapCreated
    bridgeContract.on('SwapCreated', async (swapId, user, amount, hashlock, targetChain, event) => {
      if (!this.isRunning) return;
      
      console.log('🔔 ETH → TRON swap detected:', {
        swapId: swapId.substring(0, 10) + '...',
        user,
        amount: ethers.formatEther(amount),
        targetChain
      });

      try {
        await this.processEthToTronSwap(swapId, user, amount, hashlock, targetChain);
      } catch (error) {
        console.error('❌ Failed to process ETH → TRON swap:', error);
      }
    });
  }

  /**
   * Watcher TRON → ETH swaps
   */
  private async watchTronToEthSwaps(): Promise<void> {
    console.log('👀 Watching TRON → ETH swaps...');

    // Utiliser le système d'événements Tron
    this.tronClient.watchBridgeEvents(async (event) => {
      if (!this.isRunning) return;
      
      if (event.type === 'EscrowCreated') {
        console.log('🔔 TRON → ETH swap detected:', event.data);
        
        try {
          await this.processTronToEthSwap(event.data);
        } catch (error) {
          console.error('❌ Failed to process TRON → ETH swap:', error);
        }
      }
    });
  }

  /**
   * Traiter un swap ETH → TRON
   */
  private async processEthToTronSwap(
    swapId: string,
    user: string,
    ethAmount: ethers.BigNumber,
    hashlock: string,
    targetChain: string
  ): Promise<void> {
    console.log('⚙️ Processing ETH → TRON swap...');

    try {
      // 1. Calculer l'équivalent TRX
      const ethAmountStr = ethers.formatEther(ethAmount);
      const trxAmount = await this.priceOracle.convertEthToTrx(ethAmountStr);
      console.log(`💱 Converting ${ethAmountStr} ETH → ${trxAmount} TRX`);

      // 2. Créer le bridge TRON correspondant
      const tronResult = await this.tronClient.createTronBridge(
        hashlock,
        user, // ETH address comme target
        'ethereum',
        trxAmount
      );

      if (!tronResult.success) {
        throw new Error(`TRON bridge creation failed: ${tronResult.error}`);
      }

      console.log('✅ TRON bridge created:', tronResult.swapId?.substring(0, 10) + '...');

      // 3. Monitorer la révélation du secret sur TRON
      this.monitorSecretRevelation(hashlock, swapId, tronResult.swapId!);

    } catch (error) {
      console.error('❌ ETH → TRON processing failed:', error);
    }
  }

  /**
   * Traiter un swap TRON → ETH
   */
  private async processTronToEthSwap(eventData: any): Promise<void> {
    console.log('⚙️ Processing TRON → ETH swap...');

    try {
      // 1. Calculer l'équivalent ETH
      const trxAmount = eventData.amount;
      const ethAmount = await this.priceOracle.convertTrxToEth(trxAmount);
      console.log(`💱 Converting ${trxAmount} TRX → ${ethAmount} ETH`);

      // 2. Créer le swap ETH correspondant (via 1inch ou contrat direct)
      const ethBridge = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'function createSwap(bytes32 hashlock, string calldata targetAccount) external payable returns (bytes32)',
          'function completeSwap(bytes32 swapId, bytes32 secret) external'
        ],
        this.resolverSigner
      );

      const tx = await ethBridge.createSwap(
        eventData.hashlock,
        eventData.targetAccount,
        {
          value: ethers.parseEther(ethAmount),
          gasLimit: 200000
        }
      );

      await tx.wait();
      console.log('✅ ETH bridge created:', tx.hash);

      // 3. Monitorer la révélation du secret sur ETH
      this.monitorEthSecretRevelation(eventData.hashlock, eventData.escrow);

    } catch (error) {
      console.error('❌ TRON → ETH processing failed:', error);
    }
  }

  /**
   * Monitorer la révélation du secret (ETH → TRON)
   */
  private monitorSecretRevelation(hashlock: string, ethSwapId: string, tronSwapId: string): void {
    console.log('👁️ Monitoring secret revelation for', hashlock.substring(0, 10) + '...');

    // Vérifier périodiquement si le secret a été révélé
    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Vérifier sur TRON si le swap a été complété (secret révélé)
        const tronSwap = await this.tronClient.getSwap(tronSwapId);
        
        if (tronSwap.completed) {
          console.log('🔓 Secret revealed on TRON, completing ETH side...');
          clearInterval(checkInterval);
          
          // Extraire le secret depuis les événements TRON
          const secret = await this.extractSecretFromTronEvents(tronSwapId);
          if (secret) {
            await this.completeEthSwap(ethSwapId, secret);
          }
        }
      } catch (error) {
        console.error('Error checking secret revelation:', error);
      }
    }, 10000); // Check every 10 seconds

    // Timeout après 24h
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏰ Secret revelation timeout for', hashlock.substring(0, 10) + '...');
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Monitorer la révélation du secret (TRON → ETH)
   */
  private monitorEthSecretRevelation(hashlock: string, tronSwapId: string): void {
    console.log('👁️ Monitoring ETH secret revelation for', hashlock.substring(0, 10) + '...');

    const checkInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Vérifier si le secret a été révélé sur ETH en regardant les événements
        const secret = await this.extractSecretFromEthEvents(hashlock);
        
        if (secret) {
          console.log('🔓 Secret revealed on ETH, completing TRON side...');
          clearInterval(checkInterval);
          
          // Compléter le côté TRON
          await this.tronClient.completeSwap(tronSwapId, secret);
        }
      } catch (error) {
        console.error('Error checking ETH secret revelation:', error);
      }
    }, 10000);

    setTimeout(() => {
      clearInterval(checkInterval);
      console.log('⏰ ETH secret revelation timeout for', hashlock.substring(0, 10) + '...');
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Extraire le secret depuis les événements TRON
   */
  private async extractSecretFromTronEvents(tronSwapId: string): Promise<string | null> {
    try {
      // Dans un vrai scénario, il faudrait parser les événements SwapCompleted du contrat TRON
      // Pour l'instant, on simule l'extraction du secret
      console.log('🔍 Extracting secret from TRON events for swap:', tronSwapId);
      
      // TODO: Implémenter la logique réelle d'extraction du secret depuis les événements TRON
      // Cela nécessiterait de parser les logs de transaction qui ont révélé le secret
      
      return null; // Placeholder - à implémenter avec la vraie logique
    } catch (error) {
      console.error('Failed to extract secret from TRON events:', error);
      return null;
    }
  }

  /**
   * Extraire le secret depuis les événements ETH
   */
  private async extractSecretFromEthEvents(hashlock: string): Promise<string | null> {
    try {
      console.log('🔍 Extracting secret from ETH events for hashlock:', hashlock.substring(0, 10) + '...');
      
      const bridgeContract = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'event SwapCompleted(bytes32 indexed swapId, bytes32 secret)',
          'function getSwap(bytes32 swapId) external view returns (address user, uint256 amount, bytes32 hashlock, string memory targetAccount, bool completed, bool refunded, uint256 timelock)'
        ],
        this.resolverSigner
      );

      // Chercher les événements SwapCompleted récents
      const filter = bridgeContract.filters.SwapCompleted();
      const events = await bridgeContract.queryFilter(filter, -1000); // Last 1000 blocks

      // Trouver l'événement correspondant au hashlock
      for (const event of events) {
        if (event.args) {
          const swapId = event.args.swapId;
          const secret = event.args.secret;
          
          // Vérifier si ce secret correspond au hashlock
          const computedHashlock = ethers.keccak256(secret);
          if (computedHashlock === hashlock) {
            console.log('✅ Secret found in ETH events!');
            return secret;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to extract secret from ETH events:', error);
      return null;
    }
  }

  /**
   * Compléter le swap ETH
   */
  private async completeEthSwap(ethSwapId: string, secret: string): Promise<void> {
    try {
      console.log('⚙️ Completing ETH swap with secret...');
      
      const bridgeContract = new ethers.Contract(
        this.ETH_BRIDGE_CONTRACT,
        [
          'function completeSwap(bytes32 swapId, bytes32 secret) external'
        ],
        this.resolverSigner
      );

      const tx = await bridgeContract.completeSwap(ethSwapId, secret, {
        gasLimit: 200000
      });

      await tx.wait();
      console.log('✅ ETH swap completed:', tx.hash);
    } catch (error) {
      console.error('❌ Failed to complete ETH swap:', error);
    }
  }

  /**
   * Obtenir le statut du resolver
   */
  getStatus(): { running: boolean; ethAddress: string; tronContract: string } {
    return {
      running: this.isRunning,
      ethAddress: this.resolverSigner.address,
      tronContract: this.TRON_BRIDGE_CONTRACT
    };
  }
}