# UniteDeFi Cross-Chain Bridge - Complete Mermaid Architecture

## 🎯 System Overview

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[React Frontend]
        API[REST API]
        CLI[CLI Tools]
    end

    subgraph "Cross-Chain Bridge Core"
        Resolver[1inch Fusion+ Resolver]
        Monitor[Event Monitor]
        Coordinator[Swap Coordinator]
    end

    subgraph "Ethereum Ecosystem"
        EthRPC[Ethereum RPC]
        EscrowFactory[1inch EscrowFactory<br/>0xa7bcb4...99a]
        CrossChainBridge[CrossChainBridge.sol]
        InchBridge[InchDirectBridge.sol]
        EthHTLC[Ethereum HTLCs]
    end

    subgraph "NEAR Ecosystem"
        NearRPC[NEAR RPC]
        HTLCContract[HTLC Contract<br/>lib.rs]
        NearHTLC[NEAR HTLCs]
    end

    subgraph "Infrastructure"
        DB[(Database)]
        Logs[Logging System]
        Metrics[Metrics & Monitoring]
    end

    %% User interactions
    UI --> API
    CLI --> Resolver
    API --> Resolver

    %% Core bridge connections
    Resolver --> Monitor
    Resolver --> Coordinator
    Monitor --> EthRPC
    Monitor --> NearRPC

    %% Ethereum connections
    Resolver --> EthRPC
    EthRPC --> EscrowFactory
    EthRPC --> CrossChainBridge
    EthRPC --> InchBridge
    CrossChainBridge --> EthHTLC
    InchBridge --> EthHTLC

    %% NEAR connections
    Resolver --> NearRPC
    NearRPC --> HTLCContract
    HTLCContract --> NearHTLC

    %% Infrastructure
    Resolver --> DB
    Resolver --> Logs
    Monitor --> Metrics

    classDef ethereum fill:#627EEA,stroke:#fff,color:#fff
    classDef near fill:#00C08B,stroke:#fff,color:#fff
    classDef core fill:#FF6B6B,stroke:#fff,color:#fff
    classDef ui fill:#4ECDC4,stroke:#fff,color:#000
    classDef infra fill:#45B7D1,stroke:#fff,color:#fff

    class EthRPC,EscrowFactory,CrossChainBridge,InchBridge,EthHTLC ethereum
    class NearRPC,HTLCContract,NearHTLC near
    class Resolver,Monitor,Coordinator core
    class UI,API,CLI ui
    class DB,Logs,Metrics infra
```

## 🔄 ETH → NEAR Swap Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as React Frontend
    participant Resolver as 1inch Fusion+ Resolver
    participant EthChain as Ethereum Network
    participant EscrowFactory as 1inch EscrowFactory
    participant NearChain as NEAR Network
    participant HTLCContract as NEAR HTLC Contract

    Note over User,HTLCContract: ETH → NEAR Atomic Swap Flow

    %% Step 1: User initiates swap
    User->>Frontend: Request ETH → NEAR swap
    Frontend->>User: Generate secret & hashlock
    User->>EthChain: Create 1inch Escrow with ETH
    Note right of User: User locks ETH with hashlock

    %% Step 2: Event detection
    EthChain->>EscrowFactory: Deploy EscrowSrc contract
    EscrowFactory->>Resolver: SrcEscrowCreated event
    Note right of Resolver: Event contains hashlock & escrow address

    %% Step 3: NEAR HTLC creation
    Resolver->>EscrowFactory: Call addressOfEscrowSrc()
    EscrowFactory->>Resolver: Return deterministic address
    Resolver->>NearChain: Create cross-chain HTLC
    NearChain->>HTLCContract: Deploy HTLC with same hashlock
    HTLCContract->>Resolver: HTLC created confirmation

    %% Step 4: Secret revelation & completion
    User->>EthChain: Reveal secret to claim NEAR tokens
    EthChain->>Resolver: Secret revealed in transaction
    Resolver->>NearChain: Complete swap with revealed secret
    NearChain->>User: Transfer NEAR tokens

    %% Step 5: Finalization
    Note over User,HTLCContract: Atomic swap completed successfully
    Resolver->>Frontend: Swap completion notification
    Frontend->>User: Display success & transaction details
```

## 🔄 NEAR → ETH Swap Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend as React Frontend
    participant Resolver as 1inch Fusion+ Resolver
    participant NearChain as NEAR Network
    participant HTLCContract as NEAR HTLC Contract
    participant EthChain as Ethereum Network
    participant EscrowFactory as 1inch EscrowFactory

    Note over User,EscrowFactory: NEAR → ETH Atomic Swap Flow

    %% Step 1: User initiates swap
    User->>Frontend: Request NEAR → ETH swap
    Frontend->>User: Generate secret & hashlock
    
    %% Step 2: NEAR HTLC creation
    User->>NearChain: Lock NEAR tokens in HTLC
    NearChain->>HTLCContract: Create HTLC with hashlock
    HTLCContract->>Resolver: HTLC creation event

    %% Step 3: Ethereum escrow creation
    Resolver->>EthChain: Create 1inch EscrowSrc
    EthChain->>EscrowFactory: Deploy escrow with ETH
    EscrowFactory->>Resolver: EscrowSrc created
    Note right of Resolver: Resolver provides ETH liquidity

    %% Step 4: Registration & coordination
    Resolver->>EthChain: Register cross-chain swap
    EthChain->>Resolver: Registration confirmed

    %% Step 5: Secret revelation & completion
    User->>NearChain: Reveal secret to claim ETH
    NearChain->>Resolver: Secret revealed in transaction
    Resolver->>EthChain: Complete escrow with secret
    EthChain->>User: Transfer ETH tokens

    %% Step 6: Finalization
    Note over User,EscrowFactory: Atomic swap completed successfully
    Resolver->>Frontend: Swap completion notification
    Frontend->>User: Display success & transaction details
```

## 🏗️ Component Architecture

```mermaid
graph TD
    subgraph "Frontend Layer"
        React[React Application]
        Hooks[Custom Hooks]
        Services[API Services]
        Components[UI Components]
    end

    subgraph "Backend Layer"
        ExpressAPI[Express API Server]
        Controllers[Route Controllers]
        Middleware[Auth & Validation]
        WebSockets[Real-time Updates]
    end

    subgraph "Core Bridge System"
        InchResolver[InchFusionResolver]
        NearClient[NearClient]
        EthClient[EthereumClient]
        EventListener[EscrowEventListener]
        Utils[Utility Functions]
    end

    subgraph "Blockchain Interfaces"
        EthProvider[Ethereum Provider]
        NearProvider[NEAR Provider]
        ContractABIs[Contract ABIs]
        Signers[Transaction Signers]
    end

    subgraph "Smart Contracts"
        EscrowFactory1inch[1inch EscrowFactory]
        CrossChainBridgeSol[CrossChainBridge.sol]
        InchDirectBridgeSol[InchDirectBridge.sol]
        HTLCNear[HTLC NEAR Contract]
    end

    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis Cache)]
        Prisma[Prisma ORM]
        Migrations[DB Migrations]
    end

    %% Frontend connections
    React --> Hooks
    React --> Components
    Hooks --> Services
    Services --> ExpressAPI

    %% Backend connections
    ExpressAPI --> Controllers
    Controllers --> Middleware
    Controllers --> InchResolver
    ExpressAPI --> WebSockets

    %% Core system connections
    InchResolver --> NearClient
    InchResolver --> EthClient
    InchResolver --> EventListener
    NearClient --> Utils
    EthClient --> Utils

    %% Blockchain connections
    EthClient --> EthProvider
    NearClient --> NearProvider
    EthProvider --> ContractABIs
    NearProvider --> ContractABIs
    EthProvider --> Signers
    NearProvider --> Signers

    %% Smart contract connections
    EthProvider --> EscrowFactory1inch
    EthProvider --> CrossChainBridgeSol
    EthProvider --> InchDirectBridgeSol
    NearProvider --> HTLCNear

    %% Data connections
    Controllers --> Prisma
    Prisma --> PostgreSQL
    InchResolver --> Redis
    EventListener --> PostgreSQL

    classDef frontend fill:#61DAFB,stroke:#000,color:#000
    classDef backend fill:#68A063,stroke:#fff,color:#fff
    classDef core fill:#FF6B6B,stroke:#fff,color:#fff
    classDef blockchain fill:#FFD93D,stroke:#000,color:#000
    classDef contracts fill:#9B59B6,stroke:#fff,color:#fff
    classDef data fill:#3498DB,stroke:#fff,color:#fff

    class React,Hooks,Services,Components frontend
    class ExpressAPI,Controllers,Middleware,WebSockets backend
    class InchResolver,NearClient,EthClient,EventListener,Utils core
    class EthProvider,NearProvider,ContractABIs,Signers blockchain
    class EscrowFactory1inch,CrossChainBridgeSol,InchDirectBridgeSol,HTLCNear contracts
    class PostgreSQL,Redis,Prisma,Migrations data
```

## 🔐 Security & Event Flow

```mermaid
graph TD
    subgraph "Security Layer"
        Auth[Authentication]
        RateLimit[Rate Limiting]
        Validation[Input Validation]
        Encryption[Data Encryption]
    end

    subgraph "Event Monitoring"
        EthEvents[Ethereum Event Listener]
        NearEvents[NEAR Event Listener]
        EventProcessor[Event Processor]
        EventStore[Event Store]
    end

    subgraph "Risk Management"
        AmountLimits[Amount Limits]
        TimeLocks[Time Locks]
        MultiSig[Multi-Signature]
        EmergencyStop[Emergency Stop]
    end

    subgraph "Monitoring & Alerts"
        Metrics[Performance Metrics]
        HealthCheck[Health Monitoring]
        AlertSystem[Alert System]
        Dashboard[Monitoring Dashboard]
    end

    %% Security flows
    Auth --> RateLimit
    RateLimit --> Validation
    Validation --> Encryption

    %% Event flows
    EthEvents --> EventProcessor
    NearEvents --> EventProcessor
    EventProcessor --> EventStore

    %% Risk management
    AmountLimits --> TimeLocks
    TimeLocks --> MultiSig
    MultiSig --> EmergencyStop

    %% Monitoring flows
    Metrics --> HealthCheck
    HealthCheck --> AlertSystem
    AlertSystem --> Dashboard

    %% Cross-layer connections
    EventProcessor --> AlertSystem
    Validation --> AmountLimits
    EventStore --> Metrics

    classDef security fill:#E74C3C,stroke:#fff,color:#fff
    classDef events fill:#F39C12,stroke:#fff,color:#fff
    classDef risk fill:#8E44AD,stroke:#fff,color:#fff
    classDef monitoring fill:#27AE60,stroke:#fff,color:#fff

    class Auth,RateLimit,Validation,Encryption security
    class EthEvents,NearEvents,EventProcessor,EventStore events
    class AmountLimits,TimeLocks,MultiSig,EmergencyStop risk
    class Metrics,HealthCheck,AlertSystem,Dashboard monitoring
```

## 📊 Data Flow Architecture

```mermaid
flowchart TD
    subgraph "User Input"
        WebUI[Web Interface]
        MobileApp[Mobile App]
        RESTAPI[REST API]
        GraphQLAPI[GraphQL API]
    end

    subgraph "Processing Layer"
        RequestValidator[Request Validator]
        SwapOrchestrator[Swap Orchestrator]
        StateManager[State Manager]
        TransactionBuilder[Transaction Builder]
    end

    subgraph "Blockchain Layer"
        EthTxPool[Ethereum Tx Pool]
        NearTxPool[NEAR Tx Pool]
        EthMempool[ETH Mempool Monitor]
        NearBlock[NEAR Block Monitor]
    end

    subgraph "Storage Layer"
        ActiveSwaps[(Active Swaps DB)]
        CompletedSwaps[(Completed Swaps DB)]
        UserData[(User Data DB)]
        Analytics[(Analytics DB)]
    end

    subgraph "External Systems"
        PriceFeeds[Price Feeds]
        GasOracle[Gas Oracle]
        Notifications[Notification Service]
        AuditLogs[Audit Logs]
    end

    %% Input flow
    WebUI --> RequestValidator
    MobileApp --> RequestValidator
    RESTAPI --> RequestValidator
    GraphQLAPI --> RequestValidator

    %% Processing flow
    RequestValidator --> SwapOrchestrator
    SwapOrchestrator --> StateManager
    StateManager --> TransactionBuilder

    %% Blockchain flow
    TransactionBuilder --> EthTxPool
    TransactionBuilder --> NearTxPool
    EthMempool --> StateManager
    NearBlock --> StateManager

    %% Storage flow
    StateManager --> ActiveSwaps
    StateManager --> CompletedSwaps
    RequestValidator --> UserData
    SwapOrchestrator --> Analytics

    %% External flow
    SwapOrchestrator --> PriceFeeds
    TransactionBuilder --> GasOracle
    StateManager --> Notifications
    SwapOrchestrator --> AuditLogs

    classDef input fill:#3498DB,stroke:#fff,color:#fff
    classDef processing fill:#E74C3C,stroke:#fff,color:#fff
    classDef blockchain fill:#F39C12,stroke:#fff,color:#fff
    classDef storage fill:#27AE60,stroke:#fff,color:#fff
    classDef external fill:#9B59B6,stroke:#fff,color:#fff

    class WebUI,MobileApp,RESTAPI,GraphQLAPI input
    class RequestValidator,SwapOrchestrator,StateManager,TransactionBuilder processing
    class EthTxPool,NearTxPool,EthMempool,NearBlock blockchain
    class ActiveSwaps,CompletedSwaps,UserData,Analytics storage
    class PriceFeeds,GasOracle,Notifications,AuditLogs external
```

## 🔧 Technical Stack

```mermaid
mindmap
  root((UniteDeFi Bridge))
    Frontend
      React 18
      TypeScript
      Vite
      Tailwind CSS
      Wagmi/ConnectKit
      NEAR Wallet Selector
    Backend
      Node.js
      Express.js
      TypeScript
      Prisma ORM
      PostgreSQL
      Redis
      WebSockets
    Blockchain
      Ethereum
        ethers.js v5
        1inch Fusion+ SDK
        Hardhat/Foundry
        Solidity 0.8.19
      NEAR
        near-api-js
        NEAR SDK Rust
        near-cli
        Cargo/WASM
    Infrastructure
      Docker
      Nginx
      PM2
      Prometheus
      Grafana
      GitHub Actions
    Security
      JWT Authentication
      Rate Limiting
      Input Validation
      HTTPS/TLS
      Environment Variables
      Multi-signature
```

## 🛠️ Development Workflow

```mermaid
gitgraph
    commit id: "Initial Setup"
    branch feature/ethereum-contracts
    checkout feature/ethereum-contracts
    commit id: "CrossChainBridge.sol"
    commit id: "InchDirectBridge.sol"
    commit id: "Contract Tests"
    checkout main
    merge feature/ethereum-contracts
    
    branch feature/near-contracts
    checkout feature/near-contracts
    commit id: "HTLC Contract"
    commit id: "Cross-chain Logic"
    commit id: "NEAR Tests"
    checkout main
    merge feature/near-contracts
    
    branch feature/bridge-resolver
    checkout feature/bridge-resolver
    commit id: "InchFusionResolver"
    commit id: "Event Listeners"
    commit id: "Integration Tests"
    checkout main
    merge feature/bridge-resolver
    
    branch feature/frontend
    checkout feature/frontend
    commit id: "React Components"
    commit id: "Wallet Integration"
    commit id: "UI/UX Polish"
    checkout main
    merge feature/frontend
    
    branch release/v1.0
    checkout release/v1.0
    commit id: "Production Build"
    commit id: "Security Audit"
    commit id: "Documentation"
    checkout main
    merge release/v1.0
    commit id: "v1.0 Release"
```

## 🔍 Event Monitoring System

```mermaid
stateDiagram-v2
    [*] --> Listening
    
    Listening --> EthEventDetected : SrcEscrowCreated
    Listening --> NearEventDetected : HTLCCreated
    
    EthEventDetected --> ValidatingEvent : Check hashlock
    NearEventDetected --> ValidatingEvent : Check parameters
    
    ValidatingEvent --> CreatingNearHTLC : Valid ETH event
    ValidatingEvent --> CreatingEthEscrow : Valid NEAR event
    ValidatingEvent --> IgnoringEvent : Invalid/Unmatched
    
    CreatingNearHTLC --> WaitingForSecret : HTLC created
    CreatingEthEscrow --> WaitingForSecret : Escrow created
    
    WaitingForSecret --> SecretRevealed : Secret found
    WaitingForSecret --> Timeout : Time expired
    
    SecretRevealed --> CompletingSwap : Execute completion
    Timeout --> RefundingSwap : Execute refund
    
    CompletingSwap --> SwapCompleted : Success
    RefundingSwap --> SwapRefunded : Refund complete
    
    SwapCompleted --> [*]
    SwapRefunded --> [*]
    IgnoringEvent --> Listening
```

## 🎯 Use Case Diagram

```mermaid
graph LR
    subgraph "Actors"
        User[Regular User]
        Trader[Professional Trader]
        LP[Liquidity Provider]
        Admin[System Admin]
        Monitor[External Monitor]
    end

    subgraph "Core Use Cases"
        SwapETH[Swap ETH → NEAR]
        SwapNEAR[Swap NEAR → ETH]
        ProvideLiquidity[Provide Liquidity]
        ManageLiquidity[Manage Liquidity]
        MonitorSwaps[Monitor Swaps]
        HandleFailures[Handle Failed Swaps]
        ViewAnalytics[View Analytics]
        ConfigureSystem[Configure System]
    end

    subgraph "Advanced Use Cases"
        BatchSwaps[Batch Swaps]
        ArbitrageOps[Arbitrage Operations]
        EmergencyStop[Emergency Stop]
        AuditSystem[Audit System]
        OptimizeGas[Optimize Gas Fees]
    end

    %% User interactions
    User --> SwapETH
    User --> SwapNEAR
    User --> MonitorSwaps

    %% Trader interactions
    Trader --> SwapETH
    Trader --> SwapNEAR
    Trader --> BatchSwaps
    Trader --> ArbitrageOps
    Trader --> OptimizeGas

    %% LP interactions
    LP --> ProvideLiquidity
    LP --> ManageLiquidity
    LP --> ViewAnalytics

    %% Admin interactions
    Admin --> ConfigureSystem
    Admin --> HandleFailures
    Admin --> EmergencyStop
    Admin --> AuditSystem

    %% Monitor interactions
    Monitor --> MonitorSwaps
    Monitor --> ViewAnalytics

    classDef actor fill:#3498DB,stroke:#fff,color:#fff
    classDef usecase fill:#2ECC71,stroke:#fff,color:#fff
    classDef advanced fill:#E74C3C,stroke:#fff,color:#fff

    class User,Trader,LP,Admin,Monitor actor
    class SwapETH,SwapNEAR,ProvideLiquidity,ManageLiquidity,MonitorSwaps,HandleFailures,ViewAnalytics,ConfigureSystem usecase
    class BatchSwaps,ArbitrageOps,EmergencyStop,AuditSystem,OptimizeGas advanced
```

## 📈 Performance & Scalability

```mermaid
graph TB
    subgraph "Load Balancing"
        LB[Load Balancer]
        API1[API Server 1]
        API2[API Server 2]
        API3[API Server 3]
    end

    subgraph "Caching Layer"
        Redis1[(Redis Primary)]
        Redis2[(Redis Replica)]
        CDN[CDN Network]
    end

    subgraph "Database Cluster"
        DBPrimary[(PostgreSQL Primary)]
        DBReplica1[(PostgreSQL Replica 1)]
        DBReplica2[(PostgreSQL Replica 2)]
    end

    subgraph "Blockchain Optimization"
        EthRPC1[Ethereum RPC 1]
        EthRPC2[Ethereum RPC 2]
        NearRPC1[NEAR RPC 1]
        NearRPC2[NEAR RPC 2]
        RPCBalancer[RPC Load Balancer]
    end

    subgraph "Monitoring"
        Prometheus[Prometheus]
        Grafana[Grafana]
        AlertManager[Alert Manager]
    end

    %% Load balancing
    LB --> API1
    LB --> API2
    LB --> API3

    %% Caching
    API1 --> Redis1
    API2 --> Redis1
    API3 --> Redis1
    Redis1 --> Redis2

    %% Database
    API1 --> DBPrimary
    API2 --> DBReplica1
    API3 --> DBReplica2

    %% RPC optimization
    API1 --> RPCBalancer
    API2 --> RPCBalancer
    API3 --> RPCBalancer
    RPCBalancer --> EthRPC1
    RPCBalancer --> EthRPC2
    RPCBalancer --> NearRPC1
    RPCBalancer --> NearRPC2

    %% Monitoring
    API1 --> Prometheus
    API2 --> Prometheus
    API3 --> Prometheus
    Prometheus --> Grafana
    Prometheus --> AlertManager

    classDef lb fill:#3498DB,stroke:#fff,color:#fff
    classDef cache fill:#E67E22,stroke:#fff,color:#fff
    classDef db fill:#27AE60,stroke:#fff,color:#fff
    classDef rpc fill:#9B59B6,stroke:#fff,color:#fff
    classDef monitoring fill:#E74C3C,stroke:#fff,color:#fff

    class LB,API1,API2,API3 lb
    class Redis1,Redis2,CDN cache
    class DBPrimary,DBReplica1,DBReplica2 db
    class EthRPC1,EthRPC2,NearRPC1,NearRPC2,RPCBalancer rpc
    class Prometheus,Grafana,AlertManager monitoring
```

This comprehensive Mermaid architecture documentation provides a complete visual representation of your UniteDeFi cross-chain bridge system, covering all components, interactions, flows, and technical details that your team needs to understand the project structure and functionality.
