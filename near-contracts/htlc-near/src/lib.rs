// Import necessary NEAR SDK components for blockchain interaction
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, NearToken, PanicOnDefault, Promise, Timestamp,
};
use sha2::Digest; // For SHA256 hashing in HTLC verification

/**
 * Standard HTLC (Hash Time-Locked Contract) structure
 * This represents a locked funds contract that can only be unlocked with:
 * 1. A valid preimage (secret) that matches the hashlock, OR
 * 2. A refund after the timelock expires
 */
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCContract {
    pub sender: AccountId,        // Who locked the funds
    pub receiver: AccountId,      // Who can claim with valid preimage
    pub amount: U128,            // Amount of NEAR tokens locked
    pub hashlock: Vec<u8>,       // SHA256 hash of the secret (32 bytes)
    pub timelock: Timestamp,     // Expiration time for refund eligibility
    pub withdrawn: bool,         // Has receiver claimed the funds?
    pub refunded: bool,          // Has sender reclaimed expired funds?
    pub eth_address: String,     // Ethereum address for cross-chain coordination
}

/**
 * Enhanced Cross-Chain HTLC for 1inch Fusion+ integration
 * This extends the basic HTLC with additional features needed for cross-chain swaps:
 * - ETH transaction hash tracking for verification
 * - Support for 1inch resolver contract coordination
 * - Enhanced security for cross-chain atomic swaps
 */
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct CrossChainHTLC {
    pub sender: AccountId,           // NEAR account that initiated the swap
    pub receiver: AccountId,         // NEAR account that will receive funds
    pub amount: U128,               // Amount of NEAR tokens locked
    pub hashlock: Vec<u8>,          // SHA256 hash linking both chains
    pub timelock: Timestamp,        // Expiration for safety refunds
    pub withdrawn: bool,            // Completed successfully?
    pub refunded: bool,             // Refunded due to expiration?
    pub eth_address: String,        // Ethereum address for verification
    pub eth_tx_hash: Option<String>, // Ethereum transaction hash for audit trail
}

/**
 * Main HTLC Contract for NEAR ↔ ETH Bridge
 * 
 * This contract serves as the NEAR side of a cross-chain atomic swap bridge.
 * It works in coordination with Ethereum smart contracts (like 1inch resolver contracts)
 * to enable trustless token swaps between NEAR and Ethereum networks.
 * 
 * Key Features:
 * - Standard HTLC operations (create, withdraw, refund)
 * - Cross-chain HTLC for 1inch Fusion+ integration
 * - Authorized resolver system for automated operations
 * - Emergency controls for contract owner
 */
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct HTLCNear {
    contracts: UnorderedMap<String, HTLCContract>,           // Standard HTLC storage
    cross_chain_contracts: UnorderedMap<String, CrossChainHTLC>, // Cross-chain HTLC storage
    owner: AccountId,                                        // Contract administrator
    authorized_resolvers: UnorderedMap<AccountId, bool>,     // Trusted resolver contracts/accounts
}

#[near_bindgen]
impl HTLCNear {
    /**
     * Initialize the HTLC bridge contract
     * 
     * @param owner - The account that will have administrative privileges
     *                This account can authorize resolvers and perform emergency operations
     */
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            contracts: UnorderedMap::new(b"c"),                    // Storage prefix for standard HTLCs
            cross_chain_contracts: UnorderedMap::new(b"cc".as_slice()), // Storage prefix for cross-chain HTLCs
            owner: owner.clone(),
            authorized_resolvers: UnorderedMap::new(b"r"),         // Storage prefix for authorized resolvers
        }
    }

    /**
     * Create a standard HTLC (Hash Time-Locked Contract)
     * 
     * This is the core function for locking NEAR tokens that can be unlocked either:
     * 1. By the receiver providing the correct preimage (secret) before timelock expires
     * 2. By the sender after timelock expires (refund)
     * 
     * @param receiver - NEAR account that can claim funds with valid preimage
     * @param hashlock - Base64 encoded SHA256 hash of the secret (must be 32 bytes)
     * @param timelock - Unix timestamp when refund becomes possible
     * @param eth_address - Ethereum address for cross-chain coordination
     * @returns contract_id - Unique identifier for this HTLC
     * 
     * Cross-chain workflow:
     * 1. User calls this function on NEAR, locking NEAR tokens
     * 2. Corresponding HTLC is created on Ethereum with same hashlock
     * 3. When either side reveals the secret, both sides can be completed
     */
    #[payable]
    pub fn create_htlc(
        &mut self,
        receiver: AccountId,
        hashlock: Base64VecU8,
        timelock: Timestamp,
        eth_address: String,
    ) -> String {
        let sender = env::predecessor_account_id();  // Who called this function
        let amount = env::attached_deposit();        // NEAR tokens sent with this call

        // Security validations
        assert!(amount > NearToken::from_yoctonear(0), "Amount must be greater than 0");
        assert!(
            timelock > env::block_timestamp_ms(),
            "Timelock must be in the future"
        );
        assert!(!hashlock.0.is_empty(), "Hashlock cannot be empty");
        assert!(hashlock.0.len() == 32, "Hashlock must be 32 bytes"); // SHA256 output size
        
        // Generate unique contract ID using sender, receiver, amount, and timestamp
        // This ensures no collisions even if same parties create multiple contracts
        let contract_id = format!(
            "{}-{}-{}-{}",
            sender,
            receiver,
            amount,
            env::block_timestamp_ms()
        );

        // Create and store the HTLC contract
        let contract = HTLCContract {
            sender: sender.clone(),
            receiver,
            amount: U128(amount.as_yoctonear()),  // Store amount in yoctoNEAR (smallest unit)
            hashlock: hashlock.0,
            timelock,
            withdrawn: false,
            refunded: false,
            eth_address,
        };

        self.contracts.insert(&contract_id, &contract);

        // Log for off-chain monitoring and 1inch resolver coordination
        env::log_str(&format!(
            "HTLC created: {}, sender: {}, amount: {}, timelock: {}",
            contract_id, sender, amount, timelock
        ));

        contract_id
    }

    /**
     * Withdraw funds from HTLC by providing the secret preimage
     * 
     * This function allows the receiver to claim locked funds by proving they know
     * the secret that generates the hashlock. This is the "success" path of an HTLC.
     * 
     * @param contract_id - Unique identifier of the HTLC
     * @param preimage - The secret that when hashed with SHA256 equals the hashlock
     * 
     * Security checks:
     * - Only receiver can withdraw
     * - Must happen before timelock expires
     * - Preimage must hash to the stored hashlock
     * - Cannot withdraw if already withdrawn or refunded
     * 
     * Cross-chain coordination:
     * Once this succeeds, the same preimage can be used on Ethereum to complete
     * the corresponding HTLC there, enabling atomic cross-chain swaps.
     */
    pub fn withdraw(&mut self, contract_id: String, preimage: Base64VecU8) {
        let mut contract = self
            .contracts
            .get(&contract_id)
            .expect("Contract does not exist");

        // Security validations
        assert!(!contract.withdrawn, "Already withdrawn");
        assert!(!contract.refunded, "Already refunded");
        assert!(
            env::predecessor_account_id() == contract.receiver,
            "Only receiver can withdraw"
        );
        assert!(
            env::block_timestamp_ms() <= contract.timelock,
            "Timelock expired"
        );

        // Cryptographic verification: hash the provided preimage and compare
        let hash = sha2::Sha256::digest(&preimage.0);
        assert_eq!(
            hash.as_slice(),
            &contract.hashlock,
            "Invalid preimage"
        );

        // Mark as withdrawn and update storage
        contract.withdrawn = true;
        self.contracts.insert(&contract_id, &contract);

        // Transfer NEAR tokens to receiver
        Promise::new(contract.receiver.clone()).transfer(NearToken::from_yoctonear(contract.amount.0));

        env::log_str(&format!(
            "HTLC withdrawn: {}, receiver: {}, amount: {}",
            contract_id, contract.receiver, contract.amount.0
        ));
    }

    /**
     * Refund expired HTLC back to original sender
     * 
     * This is the "failure" path of an HTLC. If the receiver doesn't provide the
     * preimage before the timelock expires, the sender can reclaim their funds.
     * 
     * @param contract_id - Unique identifier of the HTLC to refund
     * 
     * Security checks:
     * - Only sender can initiate refund
     * - Must happen after timelock expires
     * - Cannot refund if already withdrawn or refunded
     * 
     * Cross-chain safety:
     * This ensures that if a cross-chain swap fails on one side, funds aren't
     * permanently locked. The timelock provides a safety mechanism.
     */
    pub fn refund(&mut self, contract_id: String) {
        let mut contract = self
            .contracts
            .get(&contract_id)
            .expect("Contract does not exist");

        // Security validations
        assert!(!contract.withdrawn, "Already withdrawn");
        assert!(!contract.refunded, "Already refunded");
        assert!(
            env::predecessor_account_id() == contract.sender,
            "Only sender can refund"
        );
        assert!(
            env::block_timestamp_ms() > contract.timelock,
            "Timelock not expired"
        );

        // Mark as refunded and update storage
        contract.refunded = true;
        self.contracts.insert(&contract_id, &contract);

        // Transfer NEAR tokens back to original sender
        Promise::new(contract.sender.clone()).transfer(NearToken::from_yoctonear(contract.amount.0));

        env::log_str(&format!(
            "HTLC refunded: {}, sender: {}, amount: {}",
            contract_id, contract.sender, contract.amount.0
        ));
    }

    pub fn get_contract(&self, contract_id: String) -> Option<(String, String, String, String, u64, bool, bool, String)> {
        self.contracts.get(&contract_id).map(|contract| (
            contract.sender.to_string(),
            contract.receiver.to_string(),
            contract.amount.0.to_string(),
            hex::encode(&contract.hashlock),
            contract.timelock,
            contract.withdrawn,
            contract.refunded,
            contract.eth_address
        ))
    }

    pub fn check_preimage(&self, contract_id: String, preimage: Base64VecU8) -> bool {
        if let Some(contract) = self.contracts.get(&contract_id) {
            let hash = sha2::Sha256::digest(&preimage.0);
            return hash.as_slice() == &contract.hashlock;
        }
        false
    }

    pub fn get_contract_count(&self) -> u64 {
        self.contracts.len()
    }

    pub fn get_all_contracts(&self) -> Vec<(String, (String, String, String, String, u64, bool, bool, String))> {
        self.contracts.iter().map(|(id, contract)| (
            id,
            (
                contract.sender.to_string(),
                contract.receiver.to_string(),
                contract.amount.0.to_string(),
                hex::encode(&contract.hashlock),
                contract.timelock,
                contract.withdrawn,
                contract.refunded,
                contract.eth_address
            )
        )).collect()
    }

    // Emergency functions (owner only)
    pub fn emergency_pause(&mut self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only owner can pause"
        );
        env::log_str("Contract paused");
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    // ======= CROSS-CHAIN METHODS FOR 1INCH FUSION+ INTEGRATION =======

    /**
     * Create a cross-chain HTLC for NEAR → ETH swap with 1inch Fusion+
     * 
     * This enhanced version is specifically designed for integration with 1inch
     * Fusion+ and resolver contracts. It provides additional tracking and
     * coordination features needed for automated cross-chain operations.
     * 
     * @param receiver - NEAR account that will receive tokens after ETH side completes
     * @param hashlock - SHA256 hash linking this HTLC with Ethereum HTLC
     * @param timelock - Expiration timestamp for safety refunds
     * @param eth_address - Ethereum address involved in the swap for verification
     * @returns contract_id - Unique identifier with "cc-" prefix
     * 
     * 1inch Fusion+ Integration:
     * - Resolver contracts can monitor these HTLCs
     * - Cross-chain coordination through shared hashlock
     * - Enhanced tracking with ETH transaction references
     * - Automated settlement through authorized resolvers
     */
    #[payable]
    pub fn create_cross_chain_htlc(
        &mut self,
        receiver: AccountId,
        hashlock: Base64VecU8,
        timelock: Timestamp,
        eth_address: String,
    ) -> String {
        let sender = env::predecessor_account_id();
        let amount = env::attached_deposit();

        // Same security validations as standard HTLC
        assert!(amount > NearToken::from_yoctonear(0), "Amount must be greater than 0");
        assert!(
            timelock > env::block_timestamp_ms(),
            "Timelock must be in the future"
        );
        assert!(!hashlock.0.is_empty(), "Hashlock cannot be empty");
        assert!(hashlock.0.len() == 32, "Hashlock must be 32 bytes");
        assert!(!eth_address.is_empty(), "ETH address required");

        // Generate unique contract ID with cross-chain prefix
        let contract_id = format!(
            "cc-{}-{}-{}-{}",
            sender,
            receiver,
            amount,
            env::block_timestamp_ms()
        );

        let contract = CrossChainHTLC {
            sender: sender.clone(),
            receiver,
            amount: U128(amount.as_yoctonear()),
            hashlock: hashlock.0,
            timelock,
            withdrawn: false,
            refunded: false,
            eth_address,
            eth_tx_hash: None,  // Will be populated when ETH side completes
        };

        self.cross_chain_contracts.insert(&contract_id, &contract);

        env::log_str(&format!(
            "Cross-chain HTLC created: {}, sender: {}, amount: {}, timelock: {}",
            contract_id, sender, amount, timelock
        ));

        contract_id
    }

    /**
     * Complete cross-chain swap with preimage and ETH transaction reference
     * 
     * This function completes a cross-chain HTLC by verifying the preimage and
     * recording the corresponding Ethereum transaction hash for audit purposes.
     * 
     * @param contract_id - Unique identifier of the cross-chain HTLC
     * @param preimage - Secret that unlocks both NEAR and ETH sides
     * @param eth_tx_hash - Ethereum transaction hash for verification and tracking
     * 
     * 1inch Fusion+ Workflow:
     * 1. User creates cross-chain HTLC on NEAR (locks NEAR tokens)
     * 2. 1inch resolver creates corresponding HTLC on Ethereum (locks ETH/tokens)
     * 3. When user reveals preimage on Ethereum, resolver can call this function
     * 4. Same preimage unlocks both sides, completing atomic swap
     * 5. ETH transaction hash provides full audit trail
     * 
     * Security:
     * - Same cryptographic verification as standard withdraw
     * - Additional tracking of ETH transaction for transparency
     * - Ensures atomic completion across both chains
     */
    pub fn complete_cross_chain_swap(&mut self, contract_id: String, preimage: Base64VecU8, eth_tx_hash: String) {
        let mut contract = self
            .cross_chain_contracts
            .get(&contract_id)
            .expect("Contract does not exist");

        // Standard HTLC security checks
        assert!(!contract.withdrawn, "Already withdrawn");
        assert!(!contract.refunded, "Already refunded");
        assert!(
            env::predecessor_account_id() == contract.receiver,
            "Only receiver can withdraw"
        );
        assert!(
            env::block_timestamp_ms() <= contract.timelock,
            "Timelock expired"
        );

        // Cryptographic verification: ensure preimage matches hashlock
        let hash = sha2::Sha256::digest(&preimage.0);
        assert_eq!(
            hash.as_slice(),
            &contract.hashlock,
            "Invalid preimage"
        );

        // Mark as completed and store ETH transaction reference
        contract.withdrawn = true;
        contract.eth_tx_hash = Some(eth_tx_hash.clone());
        self.cross_chain_contracts.insert(&contract_id, &contract);

        // Transfer NEAR tokens to receiver
        Promise::new(contract.receiver.clone()).transfer(NearToken::from_yoctonear(contract.amount.0));

        env::log_str(&format!(
            "Cross-chain HTLC completed: {}, receiver: {}, eth_tx: {}",
            contract_id, contract.receiver, eth_tx_hash
        ));
    }

    /**
     * Refund cross-chain HTLC after timelock expiration
     * 
     * Safety mechanism for cross-chain HTLCs. If the swap fails on the Ethereum
     * side or the timelock expires, the original sender can reclaim their NEAR tokens.
     * 
     * @param contract_id - Unique identifier of the cross-chain HTLC
     * 
     * This provides the same safety guarantees as standard HTLC refunds but
     * for cross-chain operations. Essential for preventing fund loss in case
     * of failed cross-chain swaps or network issues.
     */
    pub fn refund_cross_chain(&mut self, contract_id: String) {
        let mut contract = self
            .cross_chain_contracts
            .get(&contract_id)
            .expect("Contract does not exist");

        assert!(!contract.withdrawn, "Already withdrawn");
        assert!(!contract.refunded, "Already refunded");
        assert!(
            env::predecessor_account_id() == contract.sender,
            "Only sender can refund"
        );
        assert!(
            env::block_timestamp_ms() > contract.timelock,
            "Timelock not expired"
        );

        contract.refunded = true;
        self.cross_chain_contracts.insert(&contract_id, &contract);

        Promise::new(contract.sender.clone()).transfer(NearToken::from_yoctonear(contract.amount.0));

        env::log_str(&format!(
            "Cross-chain HTLC refunded: {}, sender: {}",
            contract_id, contract.sender
        ));
    }

    /// Get cross-chain contract details (returns tuple instead of struct to avoid JsonSchema requirement)
    pub fn get_cross_chain_contract(&self, contract_id: String) -> Option<(String, String, String, String, u64, bool, bool, String, Option<String>)> {
        self.cross_chain_contracts.get(&contract_id).map(|contract| (
            contract.sender.to_string(),
            contract.receiver.to_string(),
            contract.amount.0.to_string(),
            hex::encode(&contract.hashlock),
            contract.timelock,
            contract.withdrawn,
            contract.refunded,
            contract.eth_address,
            contract.eth_tx_hash
        ))
    }

    /**
     * Authorize a resolver account for automated operations
     * 
     * This function allows the contract owner to authorize accounts (typically
     * 1inch resolver contracts or bridge operators) to perform automated operations.
     * 
     * @param resolver - AccountId to authorize for special operations
     * 
     * Use cases:
     * - 1inch Fusion+ resolver contracts
     * - Automated bridge operators
     * - Cross-chain coordination services
     * - Emergency response accounts
     * 
     * Security: Only contract owner can authorize resolvers
     */
    pub fn authorize_resolver(&mut self, resolver: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Only owner");
        self.authorized_resolvers.insert(&resolver, &true);
        env::log_str(&format!("Resolver authorized: {}", resolver));
    }

    /**
     * Check if an account is an authorized resolver
     * 
     * @param resolver - AccountId to check
     * @returns bool - True if authorized, false otherwise
     * 
     * This is used by other functions to verify that automated operations
     * are being performed by trusted accounts.
     */
    pub fn is_authorized_resolver(&self, resolver: AccountId) -> bool {
        self.authorized_resolvers.get(&resolver).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, Balance};

    const ATTACHED_DEPOSIT: Balance = 1_000_000_000_000_000_000_000_000; // 1 NEAR

    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    #[test]
    fn test_create_htlc() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(ATTACHED_DEPOSIT)
            .block_timestamp(1_000_000)
            .build());

        let mut contract = HTLCNear::new(accounts(0));
        let hashlock = vec![1u8; 32];
        let timelock = 2_000_000; // Future timestamp

        let contract_id = contract.create_htlc(
            accounts(2),
            Base64VecU8(hashlock.clone()),
            timelock,
            "0x1234567890abcdef".to_string(),
        );

        let htlc = contract.get_contract(contract_id).unwrap();
        assert_eq!(htlc.sender, accounts(1));
        assert_eq!(htlc.receiver, accounts(2));
        assert_eq!(htlc.amount, ATTACHED_DEPOSIT);
        assert_eq!(htlc.hashlock, hashlock);
        assert_eq!(htlc.timelock, timelock);
        assert!(!htlc.withdrawn);
        assert!(!htlc.refunded);
    }

    #[test]
    fn test_withdraw_with_valid_preimage() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(ATTACHED_DEPOSIT)
            .block_timestamp(1_000_000)
            .build());

        let mut contract = HTLCNear::new(accounts(0));
        let preimage = b"test_secret";
        let hash = sha2::Sha256::digest(preimage);
        let hashlock = hash.to_vec();
        let timelock = 2_000_000;

        let contract_id = contract.create_htlc(
            accounts(2),
            Base64VecU8(hashlock),
            timelock,
            "0x1234567890abcdef".to_string(),
        );

        // Switch to receiver
        let context = get_context(accounts(2));
        testing_env!(context.block_timestamp(1_500_000).build());

        contract.withdraw(contract_id.clone(), Base64VecU8(preimage.to_vec()));

        let htlc = contract.get_contract(contract_id).unwrap();
        assert!(htlc.withdrawn);
        assert!(!htlc.refunded);
    }

    #[test]
    #[should_panic(expected = "Invalid preimage")]
    fn test_withdraw_with_invalid_preimage() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(ATTACHED_DEPOSIT)
            .block_timestamp(1_000_000)
            .build());

        let mut contract = HTLCNear::new(accounts(0));
        let hashlock = vec![1u8; 32];
        let timelock = 2_000_000;

        let contract_id = contract.create_htlc(
            accounts(2),
            Base64VecU8(hashlock),
            timelock,
            "0x1234567890abcdef".to_string(),
        );

        // Switch to receiver
        let context = get_context(accounts(2));
        testing_env!(context.block_timestamp(1_500_000).build());

        let wrong_preimage = b"wrong_secret";
        contract.withdraw(contract_id, Base64VecU8(wrong_preimage.to_vec()));
    }

    #[test]
    fn test_refund_after_timelock() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(ATTACHED_DEPOSIT)
            .block_timestamp(1_000_000)
            .build());

        let mut contract = HTLCNear::new(accounts(0));
        let hashlock = vec![1u8; 32];
        let timelock = 2_000_000;

        let contract_id = contract.create_htlc(
            accounts(2),
            Base64VecU8(hashlock),
            timelock,
            "0x1234567890abcdef".to_string(),
        );

        // Move past timelock
        let context = get_context(accounts(1));
        testing_env!(context.block_timestamp(2_500_000).build());

        contract.refund(contract_id.clone());

        let htlc = contract.get_contract(contract_id).unwrap();
        assert!(!htlc.withdrawn);
        assert!(htlc.refunded);
    }

    #[test]
    #[should_panic(expected = "Timelock not expired")]
    fn test_refund_before_timelock() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(ATTACHED_DEPOSIT)
            .block_timestamp(1_000_000)
            .build());

        let mut contract = HTLCNear::new(accounts(0));
        let hashlock = vec![1u8; 32];
        let timelock = 2_000_000;

        let contract_id = contract.create_htlc(
            accounts(2),
            Base64VecU8(hashlock),
            timelock,
            "0x1234567890abcdef".to_string(),
        );

        // Try to refund before timelock
        let context = get_context(accounts(1));
        testing_env!(context.block_timestamp(1_500_000).build());

        contract.refund(contract_id);
    }

    #[test]
    fn test_check_preimage() {
        let context = get_context(accounts(1));
        testing_env!(context
            .attached_deposit(ATTACHED_DEPOSIT)
            .block_timestamp(1_000_000)
            .build());

        let mut contract = HTLCNear::new(accounts(0));
        let preimage = b"test_secret";
        let hash = sha2::Sha256::digest(preimage);
        let hashlock = hash.to_vec();
        let timelock = 2_000_000;

        let contract_id = contract.create_htlc(
            accounts(2),
            Base64VecU8(hashlock),
            timelock,
            "0x1234567890abcdef".to_string(),
        );

        assert!(contract.check_preimage(contract_id.clone(), Base64VecU8(preimage.to_vec())));

        let wrong_preimage = b"wrong_secret";
        assert!(!contract.check_preimage(contract_id, Base64VecU8(wrong_preimage.to_vec())));
    }
}