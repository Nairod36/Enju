import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { Contract, ethers } from 'ethers';

export interface EscrowEvent {
  type: 'SrcEscrowCreated' | 'DstEscrowCreated';
  escrowAddress: string;
  hashlock: string;
  txHash: string;
  timestamp: number;
  orderHash?: string;
  maker?: string;
  taker?: string;
  amount?: string;
}

export interface EscrowEventListenerState {
  events: EscrowEvent[];
  isListening: boolean;
  error: string | null;
}

/**
 * React hook for listening to 1inch EscrowFactory events in real-time
 *
 * This hook provides:
 * - Real-time event monitoring for SrcEscrowCreated and DstEscrowCreated
 * - Event filtering by hashlock
 * - Automatic cleanup on unmount
 * - TypeScript support for event data
 */
// export function useEscrowEventListener() {
//   const [state, setState] = useState<EscrowEventListenerState>({
//     events: [],
//     isListening: false,
//     error: null
//   });

//   const publicClient = usePublicClient();

//   // 1inch EscrowFactory address on Ethereum mainnet
//   const ESCROW_FACTORY_ADDRESS = '0xa7bCb4EAc8964306F9e3764f67Db6A7af6DdF99A';

//   // Simplified ABI for event listening
//   const ESCROW_FACTORY_ABI = [
//     'event SrcEscrowCreated(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) srcImmutables, tuple(uint256 maker, uint256 amount, uint256 token, uint256 safetyDeposit, uint256 chainId) dstImmutablesComplement)',
//     'event DstEscrowCreated(address escrow, bytes32 hashlock, uint256 taker)',
//     'function addressOfEscrowSrc(tuple(bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256) immutables) view returns (address)'
//   ];

//   /**
//    * Start listening for escrow events with optional hashlock filtering
//    */
//   const startListening = useCallback((targetHashlock?: string) => {
//     if (!publicClient) {
//       setState(prev => ({ ...prev, error: 'No public client available' }));
//       return;
//     }

//     setState(prev => ({ ...prev, isListening: true, error: null }));

//     try {
//       // Create ethers provider from wagmi public client
//       const provider = new ethers.providers.Web3Provider(
//         publicClient as any,
//         'any'
//       );

//       const escrowFactory = new Contract(
//         ESCROW_FACTORY_ADDRESS,
//         ESCROW_FACTORY_ABI,
//         provider
//       );

//       // Listen for SrcEscrowCreated events
//       escrowFactory.on('SrcEscrowCreated', async (srcImmutables: any, dstImmutablesComplement: any, event: any) => {
//         try {
//           // Filter by hashlock if specified
//           if (targetHashlock && srcImmutables.hashlock.toLowerCase() !== targetHashlock.toLowerCase()) {
//             return;
//           }

//           // Get deterministic escrow address
//           let escrowAddress: string;
//           try {
//             escrowAddress = await escrowFactory.addressOfEscrowSrc([
//               srcImmutables.orderHash,
//               srcImmutables.hashlock,
//               srcImmutables.maker,
//               srcImmutables.taker,
//               srcImmutables.token,
//               srcImmutables.amount,
//               srcImmutables.safetyDeposit,
//               srcImmutables.timelocks
//             ]);
//           } catch {
//             // Fallback address if factory call fails
//             escrowAddress = ethers.utils.getAddress('0x' + srcImmutables.hashlock.substring(2, 42));
//           }

//           const escrowEvent: EscrowEvent = {
//             type: 'SrcEscrowCreated',
//             escrowAddress,
//             hashlock: srcImmutables.hashlock,
//             txHash: event.transactionHash,
//             timestamp: Date.now(),
//             orderHash: srcImmutables.orderHash,
//             maker: srcImmutables.maker.toString(),
//             taker: srcImmutables.taker.toString(),
//             amount: ethers.utils.formatEther(srcImmutables.amount)
//           };

//           setState(prev => ({
//             ...prev,
//             events: [escrowEvent, ...prev.events].slice(0, 100) // Keep last 100 events
//           }));

//         } catch (error) {
//           console.error('Error processing SrcEscrowCreated event:', error);
//         }
//       });

//       // Listen for DstEscrowCreated events
//       escrowFactory.on('DstEscrowCreated', (escrow: string, hashlock: string, taker: any, event: any) => {
//         try {
//           // Filter by hashlock if specified
//           if (targetHashlock && hashlock.toLowerCase() !== targetHashlock.toLowerCase()) {
//             return;
//           }

//           const escrowEvent: EscrowEvent = {
//             type: 'DstEscrowCreated',
//             escrowAddress: escrow,
//             hashlock,
//             txHash: event.transactionHash,
//             timestamp: Date.now(),
//             taker: taker.toString()
//           };

//           setState(prev => ({
//             ...prev,
//             events: [escrowEvent, ...prev.events].slice(0, 100)
//           }));

//         } catch (error) {
//           console.error('Error processing DstEscrowCreated event:', error);
//         }
//       });

//       // Handle errors
//       escrowFactory.on('error', (error: Error) => {
//         setState(prev => ({
//           ...prev,
//           error: `Event listener error: ${error.message}`,
//           isListening: false
//         }));
//       });

//       console.log('🔍 Started listening for escrow events');

//       // Return cleanup function
//       return () => {
//         escrowFactory.removeAllListeners();
//         setState(prev => ({ ...prev, isListening: false }));
//       };

//     } catch (error) {
//       setState(prev => ({
//         ...prev,
//         error: error instanceof Error ? error.message : 'Failed to start event listener',
//         isListening: false
//       }));
//     }
//   }, [publicClient]);

//   /**
//    * Stop listening for events
//    */
//   const stopListening = useCallback(() => {
//     setState(prev => ({ ...prev, isListening: false }));
//   }, []);

//   /**
//    * Clear all events and errors
//    */
//   const clearEvents = useCallback(() => {
//     setState(prev => ({ ...prev, events: [], error: null }));
//   }, []);

//   /**
//    * Wait for a specific escrow creation with timeout
//    */
//   const waitForEscrow = useCallback(async (
//     hashlock: string,
//     eventType: 'SrcEscrowCreated' | 'DstEscrowCreated' = 'SrcEscrowCreated',
//     timeoutMs: number = 30000
//   ): Promise<EscrowEvent> => {
//     return new Promise((resolve, reject) => {
//       const timeout = setTimeout(() => {
//         reject(new Error(`Timeout waiting for ${eventType} event after ${timeoutMs}ms`));
//       }, timeoutMs);

//       const cleanup = startListening(hashlock);

//       // Check for existing events first
//       const existingEvent = state.events.find(
//         event => event.type === eventType &&
//         event.hashlock.toLowerCase() === hashlock.toLowerCase()
//       );

//       if (existingEvent) {
//         clearTimeout(timeout);
//         cleanup?.();
//         resolve(existingEvent);
//         return;
//       }

//       // Listen for new events
//       const unsubscribe = () => {
//         clearTimeout(timeout);
//         cleanup?.();
//       };

//       // This would be implemented with a proper event emitter pattern
//       // For now, we'll use a simple polling approach
//       const checkInterval = setInterval(() => {
//         const newEvent = state.events.find(
//           event => event.type === eventType &&
//           event.hashlock.toLowerCase() === hashlock.toLowerCase()
//         );

//         if (newEvent) {
//           clearInterval(checkInterval);
//           unsubscribe();
//           resolve(newEvent);
//         }
//       }, 1000);
//     });
//   }, [state.events, startListening]);

//   return {
//     ...state,
//     startListening,
//     stopListening,
//     clearEvents,
//     waitForEscrow
//   };
// }
