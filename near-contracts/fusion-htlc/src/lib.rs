use near_sdk::{
    collections::UnorderedMap,
    env, near_bindgen, AccountId, PanicOnDefault, Promise, 
    serde::{Deserialize, Serialize},
    json_types::U128,
    NearToken, Gas, require, log,
    borsh::{BorshDeserialize, BorshSerialize}
};
use serde_json::json;
use sha2::{Digest, Sha256};
use hex;

// Gas for callbacks (currently unused but kept for future use)
#[allow(dead_code)]
const CALLBACK_GAS: Gas = Gas::from_tgas(20);

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCSwap {
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: U128,                // Total amount locked
    pub amount_remaining: U128,      // Amount still available to claim
    pub amount_claimed: U128,        // Total amount already claimed
    pub token: Option<AccountId>,    // None = NEAR, Some = FT contract
    pub hashlock: String,            // hex encoded hash
    pub timelock: u64,              // timestamp in nanoseconds
    pub secret: Option<String>,      // revealed secret
    pub is_completed: bool,          // true when fully claimed or refunded
    pub is_refunded: bool,
    pub eth_tx_hash: Option<String>, // Reference to originating ETH tx
    pub claimers: Vec<(AccountId, U128)>, // Track who claimed how much
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapInitiatedEvent {
    pub swap_id: String,
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: U128,
    pub hashlock: String,
    pub timelock: u64,
    pub eth_tx_hash: Option<String>,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapClaimedEvent {
    pub swap_id: String,
    pub claimer: AccountId,
    pub secret: String,
    pub amount: U128,
    pub amount_remaining: U128,
    pub is_completed: bool,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapRefundedEvent {
    pub swap_id: String,
    pub refunder: AccountId,
    pub amount: U128,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EthSwapRequest {
    pub swap_id: String,
    pub near_sender: AccountId,
    pub eth_recipient: String,      // Ethereum address as string
    pub amount: U128,
    pub near_token: Option<AccountId>,
    pub eth_token: String,          // Ethereum token address
    pub hashlock: String,
    pub timelock: u64,
    pub fusion_order_params: String, // JSON string with Fusion+ order parameters
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EthSwapRequestedEvent {
    pub swap_id: String,
    pub near_sender: AccountId,
    pub eth_recipient: String,
    pub amount: U128,
    pub hashlock: String,
    pub timelock: u64,
    pub eth_token: String,
}

#[near_bindgen]
#[derive(BorshSerialize, BorshDeserialize, PanicOnDefault)]
pub struct FusionHTLC {
    pub swaps: UnorderedMap<String, HTLCSwap>,
    pub eth_swap_requests: UnorderedMap<String, EthSwapRequest>, // NEAR→ETH swap requests
    pub owner: AccountId,
    pub claims_in_progress: UnorderedMap<String, bool>, // Anti-reentrancy protection
}

#[near_bindgen]
impl FusionHTLC {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            swaps: UnorderedMap::new(b"s"),
            eth_swap_requests: UnorderedMap::new(b"e"),
            owner,
            claims_in_progress: UnorderedMap::new(b"c"),
        }
    }

    /// Initiate a new HTLC swap
    /// Called when funds are locked on Ethereum and we need to lock corresponding funds on Near
    #[payable]
    pub fn initiate_swap(
        &mut self,
        receiver: AccountId,
        hashlock: String,
        timelock: u64,
        eth_tx_hash: Option<String>,
    ) -> String {
        let sender = env::predecessor_account_id();
        let amount = env::attached_deposit();
        
        require!(amount.as_yoctonear() > 0, "Amount must be greater than 0");
        require!(timelock > env::block_timestamp(), "Timelock must be in the future");
        require!(hashlock.len() == 64, "Hashlock must be 32 bytes hex string"); // 32 bytes = 64 hex chars
        
        // Generate unique swap ID
        let swap_id = self.generate_swap_id(&sender, &receiver, &hashlock, timelock);
        
        require!(self.swaps.get(&swap_id).is_none(), "Swap already exists");

        let swap = HTLCSwap {
            sender: sender.clone(),
            receiver: receiver.clone(),
            amount: U128(amount.as_yoctonear()),
            amount_remaining: U128(amount.as_yoctonear()),
            amount_claimed: U128(0),
            token: None, // NEAR native token
            hashlock: hashlock.clone(),
            timelock,
            secret: None,
            is_completed: false,
            is_refunded: false,
            eth_tx_hash: eth_tx_hash.clone(),
            claimers: Vec::new(),
        };

        self.swaps.insert(&swap_id, &swap);

        // Emit event
        log!("EVENT_SWAP_INITIATED:{}", serde_json::to_string(&SwapInitiatedEvent {
            swap_id: swap_id.clone(),
            sender,
            receiver,
            amount: U128(amount.as_yoctonear()),
            hashlock,
            timelock,
            eth_tx_hash,
        }).unwrap());

        swap_id
    }

    /// Claim a partial amount from the swap by revealing the secret
    pub fn claim_swap(&mut self, swap_id: String, secret: String, amount: U128) -> Promise {
        let claimer = env::predecessor_account_id();
        let mut swap = self.swaps.get(&swap_id).expect("Swap not found");
        
        require!(!swap.is_completed, "Swap already completed");
        require!(!swap.is_refunded, "Swap already refunded");
        require!(env::block_timestamp() < swap.timelock, "Swap expired");
        
        // Verify the secret matches the hashlock
        let secret_hash = self.hash_secret(&secret);
        require!(secret_hash == swap.hashlock, "Invalid secret");
        
        let claim_amount: u128 = amount.into();
        let remaining_amount: u128 = swap.amount_remaining.into();
        
        require!(claim_amount > 0, "Claim amount must be greater than 0");
        require!(claim_amount <= remaining_amount, "Claim amount exceeds remaining balance");
        
        // Anti-reentrancy: mark as in-progress
        require!(!self.is_claiming_in_progress(&swap_id), "Claim already in progress");
        self.mark_claim_in_progress(&swap_id);

        // Update swap state
        swap.secret = Some(secret.clone());
        swap.amount_remaining = U128(remaining_amount - claim_amount);
        swap.amount_claimed = U128(swap.amount_claimed.0 + claim_amount);
        swap.claimers.push((claimer.clone(), amount));
        
        // Mark as completed if fully claimed
        if swap.amount_remaining.0 == 0 {
            swap.is_completed = true;
        }
        
        self.swaps.insert(&swap_id, &swap);

        let payout = claim_amount;
        
        // Security check: ensure payout is reasonable
        require!(payout > 0, "Payout amount must be positive");

        // Emit event
        log!("EVENT_SWAP_CLAIMED:{}", serde_json::to_string(&SwapClaimedEvent {
            swap_id: swap_id.clone(),
            claimer: claimer.clone(),
            secret,
            amount: U128(payout),
            amount_remaining: swap.amount_remaining,
            is_completed: swap.is_completed,
        }).unwrap());

        // Clear claim in progress and transfer funds
        self.clear_claim_in_progress(&swap_id);
        Promise::new(claimer).transfer(NearToken::from_yoctonear(payout))
    }

    /// Refund the remaining amount after timelock expires
    pub fn refund_swap(&mut self, swap_id: String) -> Promise {
        let refunder = env::predecessor_account_id();
        let mut swap = self.swaps.get(&swap_id).expect("Swap not found");
        
        require!(!swap.is_completed, "Swap already completed");
        require!(!swap.is_refunded, "Swap already refunded");
        require!(env::block_timestamp() >= swap.timelock, "Swap not expired yet");
        
        // Only sender can refund
        require!(refunder == swap.sender, "Only sender can refund");

        let refund_amount: u128 = swap.amount_remaining.into();
        require!(refund_amount > 0, "No amount left to refund");

        swap.is_refunded = true;
        swap.is_completed = true;
        self.swaps.insert(&swap_id, &swap);

        // Emit event
        log!("EVENT_SWAP_REFUNDED:{}", serde_json::to_string(&SwapRefundedEvent {
            swap_id: swap_id.clone(),
            refunder: refunder.clone(),
            amount: U128(refund_amount),
        }).unwrap());

        // Refund remaining amount to sender
        Promise::new(refunder).transfer(NearToken::from_yoctonear(refund_amount))
    }

    /// Get swap details
    pub fn get_swap(&self, swap_id: String) -> Option<HTLCSwap> {
        self.swaps.get(&swap_id)
    }

    /// Get all swaps for a specific account
    pub fn get_swaps_by_account(&self, account: AccountId, from_index: u64, limit: u64) -> Vec<(String, HTLCSwap)> {
        self.swaps
            .iter()
            .filter(|(_, swap)| swap.sender == account || swap.receiver == account)
            .skip(from_index as usize)
            .take(limit as usize)
            .collect()
    }

    /// Get swap status with remaining amount
    pub fn get_swap_status(&self, swap_id: String) -> Option<serde_json::Value> {
        if let Some(swap) = self.swaps.get(&swap_id) {
            Some(json!({
                "swap_id": swap_id,
                "is_completed": swap.is_completed,
                "is_refunded": swap.is_refunded,
                "amount_total": swap.amount,
                "amount_remaining": swap.amount_remaining,
                "amount_claimed": swap.amount_claimed,
                "timelock": swap.timelock,
                "current_time": env::block_timestamp(),
                "is_expired": env::block_timestamp() >= swap.timelock,
                "claimers_count": swap.claimers.len(),
                "secret_revealed": swap.secret.is_some()
            }))
        } else {
            None
        }
    }

    /// Auto-complete expired swaps (can be called by anyone)
    pub fn cleanup_expired_swap(&mut self, swap_id: String) -> bool {
        if let Some(mut swap) = self.swaps.get(&swap_id) {
            // Only cleanup if expired and not already completed
            if env::block_timestamp() >= swap.timelock && !swap.is_completed {
                swap.is_completed = true;
                
                // If not refunded yet, mark as available for refund
                if !swap.is_refunded && swap.amount_remaining.0 > 0 {
                    log!(
                        "Swap {} expired and available for refund. Remaining: {}", 
                        swap_id, 
                        swap.amount_remaining.0
                    );
                }
                
                self.swaps.insert(&swap_id, &swap);
                return true;
            }
        }
        false
    }

    /// Batch cleanup multiple expired swaps
    pub fn cleanup_expired_swaps(&mut self, swap_ids: Vec<String>) -> Vec<String> {
        let mut cleaned = Vec::new();
        for swap_id in swap_ids {
            if self.cleanup_expired_swap(swap_id.clone()) {
                cleaned.push(swap_id);
            }
        }
        cleaned
    }

    /// Check if a secret is valid for a given hashlock
    pub fn verify_secret(&self, secret: String, hashlock: String) -> bool {
        self.hash_secret(&secret) == hashlock
    }

    /// Owner functions (fees removed - direct transfers only)

    // Private helper functions
    fn generate_swap_id(&self, sender: &AccountId, receiver: &AccountId, hashlock: &str, timelock: u64) -> String {
        let input = format!("{}-{}-{}-{}", sender, receiver, hashlock, timelock);
        let hash = Sha256::digest(input.as_bytes());
        hex::encode(hash)
    }

    fn hash_secret(&self, secret: &str) -> String {
        let hash = Sha256::digest(secret.as_bytes());
        hex::encode(hash)
    }
    
    /// Request a swap from NEAR to Ethereum
    /// This locks NEAR tokens and notifies the relayer to create a Fusion+ order
    #[payable]
    pub fn request_eth_swap(
        &mut self,
        eth_recipient: String,
        eth_token: String,
        hashlock: String,
        timelock: u64,
        fusion_order_params: String,
    ) -> String {
        let near_sender = env::predecessor_account_id();
        let amount = env::attached_deposit();
        
        require!(amount.as_yoctonear() > 0, "Amount must be greater than 0");
        require!(timelock > env::block_timestamp(), "Timelock must be in the future");
        require!(hashlock.len() == 64, "Hashlock must be 32 bytes hex string");
        require!(eth_recipient.len() == 42 && eth_recipient.starts_with("0x"), "Invalid Ethereum address");
        
        let swap_id = format!("near_to_eth_{}", env::block_timestamp());
        
        let eth_swap_request = EthSwapRequest {
            swap_id: swap_id.clone(),
            near_sender: near_sender.clone(),
            eth_recipient: eth_recipient.clone(),
            amount: U128(amount.as_yoctonear()),
            near_token: None, // NEAR tokens for now
            eth_token: eth_token.clone(),
            hashlock: hashlock.clone(),
            timelock,
            fusion_order_params,
        };
        
        // Store the request
        self.eth_swap_requests.insert(&swap_id, &eth_swap_request);
        
        // Emit event for relayer to detect
        let event = EthSwapRequestedEvent {
            swap_id: swap_id.clone(),
            near_sender,
            eth_recipient,
            amount: U128(amount.as_yoctonear()),
            hashlock,
            timelock,
            eth_token,
        };
        
        log!("EVENT_ETH_SWAP_REQUESTED:{}", serde_json::to_string(&event).unwrap());
        
        swap_id
    }

    /// Get an Ethereum swap request by ID
    pub fn get_eth_swap_request(&self, swap_id: String) -> Option<EthSwapRequest> {
        self.eth_swap_requests.get(&swap_id)
    }

    /// Complete an Ethereum swap request by providing the secret
    /// This unlocks the NEAR tokens to the specified recipient
    pub fn complete_eth_swap(&mut self, swap_id: String, secret: String, recipient: AccountId) {
        let request = self.eth_swap_requests.get(&swap_id)
            .expect("Ethereum swap request not found");
        
        // Verify the secret matches the hashlock
        let hash = hex::encode(Sha256::digest(secret.as_bytes()));
        require!(hash == request.hashlock, "Invalid secret");
        
        // Check timelock
        require!(env::block_timestamp() <= request.timelock, "Swap expired");
        
        // Transfer the locked NEAR tokens to recipient
        Promise::new(recipient.clone()).transfer(NearToken::from_yoctonear(request.amount.0));
        
        // Remove the request
        self.eth_swap_requests.remove(&swap_id);
        
        log!("Ethereum swap {} completed, NEAR tokens sent to {}", swap_id, recipient);
    }

    /// Refund an Ethereum swap request if it has expired
    pub fn refund_eth_swap(&mut self, swap_id: String) {
        let request = self.eth_swap_requests.get(&swap_id)
            .expect("Ethereum swap request not found");
        
        // Check that timelock has expired
        require!(env::block_timestamp() > request.timelock, "Swap not yet expired");
        
        // Refund the locked NEAR tokens to original sender
        Promise::new(request.near_sender.clone()).transfer(NearToken::from_yoctonear(request.amount.0));
        
        // Remove the request
        self.eth_swap_requests.remove(&swap_id);
        
        log!("Ethereum swap {} refunded to {}", swap_id, request.near_sender);
    }

    // Anti-reentrancy helper functions
    fn is_claiming_in_progress(&self, swap_id: &String) -> bool {
        self.claims_in_progress.get(swap_id).unwrap_or(false)
    }
    
    fn mark_claim_in_progress(&mut self, swap_id: &String) {
        self.claims_in_progress.insert(swap_id, &true);
    }
    
    fn clear_claim_in_progress(&mut self, swap_id: &String) {
        self.claims_in_progress.remove(swap_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use sha2::{Digest, Sha256};

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    #[test]
    fn test_initiate_and_claim_swap() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        // Test secret and its hash
        let secret = "test_secret_123";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        // Initiate swap
        context.attached_deposit(NearToken::from_near(1)); // 1 NEAR
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.initiate_swap(
            accounts(1),
            expected_hash.clone(),
            2_000_000_000, // Future timelock
            Some("0x123".to_string())
        );
        
        // Verify swap created
        let swap = contract.get_swap(swap_id.clone()).unwrap();
        assert_eq!(swap.sender, accounts(0));
        assert_eq!(swap.receiver, accounts(1));
        assert_eq!(swap.amount_remaining.0, 1_000_000_000_000_000_000_000_000);
        
        // Claim partial amount (0.5 NEAR)
        context.predecessor_account_id(accounts(1));
        testing_env!(context.build());
        
        let claim_amount = U128(500_000_000_000_000_000_000_000); // 0.5 NEAR
        contract.claim_swap(swap_id.clone(), secret.to_string(), claim_amount);
        
        // Verify partial claim
        let swap = contract.get_swap(swap_id.clone()).unwrap();
        assert_eq!(swap.amount_remaining.0, 500_000_000_000_000_000_000_000); // 0.5 NEAR remaining
        assert_eq!(swap.amount_claimed.0, 500_000_000_000_000_000_000_000); // 0.5 NEAR claimed
        assert!(!swap.is_completed); // Not completed yet
        assert_eq!(swap.claimers.len(), 1);
        
        // Claim remaining amount
        let remaining_amount = U128(500_000_000_000_000_000_000_000);
        contract.claim_swap(swap_id.clone(), secret.to_string(), remaining_amount);
        
        // Verify full completion
        let swap = contract.get_swap(swap_id).unwrap();
        assert_eq!(swap.amount_remaining.0, 0);
        assert_eq!(swap.amount_claimed.0, 1_000_000_000_000_000_000_000_000); // Full amount without fees
        assert!(swap.is_completed);
        assert_eq!(swap.claimers.len(), 2);
    }

    #[test]
    fn test_partial_claims() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret_partial";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        // Initiate swap with 2 NEAR
        context.attached_deposit(NearToken::from_near(2)); // 2 NEAR
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.initiate_swap(
            accounts(1),
            expected_hash.clone(),
            2_000_000_000,
            None
        );
        
        // First claimer takes 0.5 NEAR
        context.predecessor_account_id(accounts(1));
        testing_env!(context.build());
        
        contract.claim_swap(
            swap_id.clone(), 
            secret.to_string(), 
            U128(500_000_000_000_000_000_000_000)
        );
        
        let swap = contract.get_swap(swap_id.clone()).unwrap();
        assert_eq!(swap.amount_remaining.0, 1_500_000_000_000_000_000_000_000);
        assert!(!swap.is_completed);
        
        // Second claimer takes 1 NEAR
        context.predecessor_account_id(accounts(2));
        testing_env!(context.build());
        
        contract.claim_swap(
            swap_id.clone(), 
            secret.to_string(), 
            U128(1_000_000_000_000_000_000_000_000)
        );
        
        let swap = contract.get_swap(swap_id.clone()).unwrap();
        assert_eq!(swap.amount_remaining.0, 500_000_000_000_000_000_000_000);
        assert!(!swap.is_completed);
        
        // Third claimer takes remaining 0.5 NEAR
        context.predecessor_account_id(accounts(3));
        testing_env!(context.build());
        
        contract.claim_swap(
            swap_id.clone(), 
            secret.to_string(), 
            U128(500_000_000_000_000_000_000_000)
        );
        
        let swap = contract.get_swap(swap_id).unwrap();
        assert_eq!(swap.amount_remaining.0, 0);
        assert!(swap.is_completed);
        assert_eq!(swap.claimers.len(), 3);
    }

    #[test]
    fn test_refund_after_timelock() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret_456";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        // Initiate swap
        context.attached_deposit(NearToken::from_near(1));
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.initiate_swap(
            accounts(1),
            expected_hash,
            1_500_000_000, // Timelock in past
            None
        );
        
        // Move time forward past timelock
        context.block_timestamp(2_000_000_000);
        testing_env!(context.build());
        
        // Refund swap
        contract.refund_swap(swap_id.clone());
        
        // Verify swap refunded
        let swap = contract.get_swap(swap_id).unwrap();
        assert!(swap.is_refunded);
        assert!(swap.is_completed);
    }

    #[test]
    fn test_request_eth_swap() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret_eth";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        // Request ETH swap with 1 NEAR
        context.attached_deposit(NearToken::from_near(1)); // 1 NEAR
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.request_eth_swap(
            "0x1234567890123456789012345678901234567890".to_string(),
            "0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2".to_string(), // USDC
            expected_hash,
            2_000_000_000, // 2 seconds timelock
            "{}".to_string() // Empty fusion params for test
        );
        
        // Verify eth swap request was created
        let request = contract.get_eth_swap_request(swap_id.clone()).unwrap();
        assert_eq!(request.near_sender, accounts(0));
        assert_eq!(request.eth_recipient, "0x1234567890123456789012345678901234567890");
        assert_eq!(request.amount.0, 1_000_000_000_000_000_000_000_000);
        assert_eq!(request.eth_token, "0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2");
    }

    #[test]
    fn test_complete_eth_swap() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret_complete";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        // Request ETH swap
        context.attached_deposit(NearToken::from_near(1));
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.request_eth_swap(
            "0x1234567890123456789012345678901234567890".to_string(),
            "0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2".to_string(),
            expected_hash,
            2_000_000_000,
            "{}".to_string()
        );
        
        // Complete the swap by providing secret
        contract.complete_eth_swap(
            swap_id.clone(),
            secret.to_string(),
            accounts(1) // Recipient
        );
        
        // Verify request was removed
        assert!(contract.get_eth_swap_request(swap_id).is_none());
    }

    #[test]
    fn test_refund_eth_swap() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret_refund";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        // Request ETH swap with short timelock
        context.attached_deposit(NearToken::from_near(1));
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.request_eth_swap(
            "0x1234567890123456789012345678901234567890".to_string(),
            "0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2".to_string(),
            expected_hash,
            1_500_000_000, // Timelock in past
            "{}".to_string()
        );
        
        // Move time forward past timelock
        context.block_timestamp(2_000_000_000);
        testing_env!(context.build());
        
        // Refund the eth swap
        contract.refund_eth_swap(swap_id.clone());
        
        // Verify request was removed
        assert!(contract.get_eth_swap_request(swap_id).is_none());
    }

    #[test]
    #[should_panic(expected = "Invalid Ethereum address")]
    fn test_request_eth_swap_invalid_address() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        context.attached_deposit(NearToken::from_near(1));
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        // Should panic with invalid Ethereum address
        contract.request_eth_swap(
            "invalid_address".to_string(),
            "0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2".to_string(),
            expected_hash,
            2_000_000_000,
            "{}".to_string()
        );
    }

    #[test]
    #[should_panic(expected = "Invalid secret")]
    fn test_complete_eth_swap_wrong_secret() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());
        
        let mut contract = FusionHTLC::new(accounts(0));
        
        let secret = "test_secret";
        let expected_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        
        context.attached_deposit(NearToken::from_near(1));
        context.block_timestamp(1_000_000_000);
        testing_env!(context.build());
        
        let swap_id = contract.request_eth_swap(
            "0x1234567890123456789012345678901234567890".to_string(),
            "0xA0b86a33E6417c7E52e62b1F4e68CE6A8d4297b2".to_string(),
            expected_hash,
            2_000_000_000,
            "{}".to_string()
        );
        
        // Should panic with wrong secret
        contract.complete_eth_swap(
            swap_id,
            "wrong_secret".to_string(),
            accounts(1)
        );
    }
}