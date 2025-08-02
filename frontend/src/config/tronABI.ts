// TronFusionBridge contract ABI
export const TRON_FUSION_BRIDGE_ABI = [
  {
    "inputs": [
      {
        "name": "hashlock",
        "type": "bytes32"
      },
      {
        "name": "targetAccount", 
        "type": "string"
      },
      {
        "name": "targetChain",
        "type": "string"
      }
    ],
    "name": "createTronBridge",
    "outputs": [
      {
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  }
];
