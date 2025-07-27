use near_sdk::{
    collections::UnorderedMap,
    env, near_bindgen, AccountId, Balance, PanicOnDefault, Promise, 
    serde::{Deserialize, Serialize},
    json_types::U128,
    Gas, CryptoHash
};
use serde_json::json;
use sha2::{Digest, Sha256};
use hex;

// Gas for callbacks
const CALLBACK_GAS: Gas = Gas(20_000_000_000_000);

#[derive(Serialize, Deserialize, Clone)]
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

#[derive(Serialize, Deserialize)]
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

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapClaimedEvent {
    pub swap_id: String,
    pub claimer: AccountId,
    pub secret: String,
    pub amount: U128,
    pub amount_remaining: U128,
    pub is_completed: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapRefundedEvent {
    pub swap_id: String,
    pub refunder: AccountId,
    pub amount: U128,
}

#[near_bindgen]
#[derive(PanicOnDefault)]
pub struct FusionHTLC {
    pub swaps: UnorderedMap<String, HTLCSwap>,
    pub owner: AccountId,
    pub claims_in_progress: UnorderedMap<String, bool>, // Anti-reentrancy protection
}

#[near_bindgen]
impl FusionHTLC {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            swaps: UnorderedMap::new(b"s"),
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
        
        require!(amount > 0, "Amount must be greater than 0");
        require!(timelock > env::block_timestamp(), "Timelock must be in the future");
        require!(hashlock.len() == 64, "Hashlock must be 32 bytes hex string"); // 32 bytes = 64 hex chars
        
        // Generate unique swap ID
        let swap_id = self.generate_swap_id(&sender, &receiver, &hashlock, timelock);
        
        require!(!self.swaps.contains_key(&swap_id), "Swap already exists");

        let swap = HTLCSwap {
            sender: sender.clone(),
            receiver: receiver.clone(),
            amount: U128(amount),
            amount_remaining: U128(amount),
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
        env::log_str(&serde_json::to_string(&SwapInitiatedEvent {
            swap_id: swap_id.clone(),
            sender,
            receiver,
            amount: U128(amount),
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
        env::log_str(&serde_json::to_string(&SwapClaimedEvent {
            swap_id: swap_id.clone(),
            claimer: claimer.clone(),
            secret,
            amount: U128(payout),
            amount_remaining: swap.amount_remaining,
            is_completed: swap.is_completed,
        }).unwrap());

        // Clear claim in progress and transfer funds
        self.clear_claim_in_progress(&swap_id);
        Promise::new(claimer).transfer(payout)
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
        env::log_str(&serde_json::to_string(&SwapRefundedEvent {
            swap_id: swap_id.clone(),
            refunder: refunder.clone(),
            amount: U128(refund_amount),
        }).unwrap());

        // Refund remaining amount to sender
        Promise::new(refunder).transfer(refund_amount)
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
                    env::log_str(&format!(
                        "Swap {} expired and available for refund. Remaining: {}", 
                        swap_id, 
                        swap.amount_remaining.0
                    ));
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
    
    // Anti-reentrancy helper functions
    fn is_claiming_in_progress(&self, swap_id: &str) -> bool {
        self.claims_in_progress.get(swap_id).unwrap_or(false)
    }
    
    fn mark_claim_in_progress(&mut self, swap_id: &str) {
        self.claims_in_progress.insert(swap_id, &true);
    }
    
    fn clear_claim_in_progress(&mut self, swap_id: &str) {
        self.claims_in_progress.remove(swap_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, MockedBlockchain};
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
        context.attached_deposit(1_000_000_000_000_000_000_000_000); // 1 NEAR
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
        context.attached_deposit(2_000_000_000_000_000_000_000_000); // 2 NEAR
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
        context.attached_deposit(1_000_000_000_000_000_000_000_000);
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
}