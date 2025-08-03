// TronFusionBridge contract ABI - real ABI from deployed contract
export const TRON_FUSION_BRIDGE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "orderHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "maker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "taker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "tronMaker",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "ethTaker",
        "type": "string"
      }
    ],
    "name": "EscrowCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "escrow",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "targetAccount",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "targetChain",
        "type": "string"
      }
    ],
    "name": "EscrowCreated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "targetAccount",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "targetChain",
        "type": "string"
      }
    ],
    "name": "createTronBridge",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];
