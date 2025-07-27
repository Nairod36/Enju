import { createAppKit } from '@reown/appkit/react'

import { WagmiProvider } from 'wagmi'
import { useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ActionButtonList } from './components/ActionButtonList'
import { SmartContractActionButtonList } from './components/SmartContractActionButtonList'
import { InfoList } from './components/InfoList'
import FusionPlusWrapper from './components/FusionPlusWrapper'
import SwapCreator from './components/SwapCreator'
import SwapList from './components/SwapList'
import { projectId, metadata, networks, wagmiAdapter } from './config'

import "./App.css"

const queryClient = new QueryClient()

const generalConfig = {
  projectId,
  networks,
  metadata,
  themeMode: 'light' as const,
  themeVariables: {
    '--w3m-accent': '#000000',
  }
}

// Create modal
createAppKit({
  adapters: [wagmiAdapter],
  ...generalConfig,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})


export function App() {
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | undefined>(undefined);
  const [signedMsg, setSignedMsg] = useState('');
  const [balance, setBalance] = useState('');
  const [createdSwaps, setCreatedSwaps] = useState<any[]>([]);

  const receiveHash = (hash: `0x${string}`) => {
    setTransactionHash(hash);
  };

  const receiveSignedMsg = (signedMsg: string) => {
    setSignedMsg(signedMsg);
  };

  const receivebalance = (balance: string) => {
    setBalance(balance);
  };

  const handleSwapCreated = (swapData: any) => {
    setCreatedSwaps(prev => [swapData, ...prev]);
  };

  return (
    <div className={"pages"}>
      <img src="/reown.svg" alt="Reown" style={{ width: '150px', height: '150px' }} />
      <h1>AppKit Wagmi React dApp Example</h1>
      <WagmiProvider config={wagmiAdapter.wagmiConfig}>
        <QueryClientProvider client={queryClient}>
            <appkit-button />
            
            {/* Nouvelle section pour les swaps cross-chain */}
            <div style={{ margin: '20px 0' }}>
              <SwapCreator onSwapCreated={handleSwapCreated} />
              <SwapList swaps={createdSwaps} />
            </div>
            
            <ActionButtonList sendHash={receiveHash} sendSignMsg={receiveSignedMsg} sendBalance={receivebalance}/>
            <SmartContractActionButtonList />
            <FusionPlusWrapper />
            <div className="advice">
              <p>
                This projectId only works on localhost. <br/>
                Go to <a href="https://cloud.reown.com" target="_blank" className="link-button" rel="Reown Cloud">Reown Cloud</a> to get your own.
              </p>
            </div>
            <InfoList hash={transactionHash} signedMsg={signedMsg} balance={balance}/>
        </QueryClientProvider>
      </WagmiProvider>
    </div>
  );
}

export default App;
