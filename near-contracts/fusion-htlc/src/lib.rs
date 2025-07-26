use near_sdk::{
    collections::UnorderedMap,
    env, near_bindgen, AccountId, Balance, PanicOnDefault, Promise, 
    serde::{Deserialize, Serialize},
    json_types::U128,
    Gas, CryptoHash
};
use serde_json::json;
use sha2::{Digest, Sha256};

// Gas for callbacks
const CALLBACK_GAS: Gas = Gas(20_000_000_000_000);

#[derive(Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCSwap {
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: U128,
    pub token: Option<AccountId>, // None = NEAR, Some = FT contract
    pub hashlock: String,         // hex encoded hash
    pub timelock: u64,           // timestamp in nanoseconds
    pub secret: Option<String>,   // revealed secret
    pub is_claimed: bool,
    pub is_refunded: bool,
    pub eth_tx_hash: Option<String>, // Reference to originating ETH tx
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
    pub fee_rate: u128, // Fee in basis points (e.g., 30 = 0.3%)
}

#[near_bindgen]
impl FusionHTLC {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            swaps: UnorderedMap::new(b"s"),
            owner,
            fee_rate: 30, // 0.3% default fee
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
            token: None, // NEAR native token
            hashlock: hashlock.clone(),
            timelock,
            secret: None,
            is_claimed: false,
            is_refunded: false,
            eth_tx_hash: eth_tx_hash.clone(),
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

    /// Claim the swap by revealing the secret
    pub fn claim_swap(&mut self, swap_id: String, secret: String) -> Promise {
        let claimer = env::predecessor_account_id();
        let mut swap = self.swaps.get(&swap_id).expect("Swap not found");
        
        require!(!swap.is_claimed, "Swap already claimed");
        require!(!swap.is_refunded, "Swap already refunded");
        require!(env::block_timestamp() < swap.timelock, "Swap expired");
        
        // Verify the secret matches the hashlock
        let secret_hash = self.hash_secret(&secret);
        require!(secret_hash == swap.hashlock, "Invalid secret");
        
        // Only receiver can claim
        require!(claimer == swap.receiver, "Only receiver can claim");

        swap.secret = Some(secret.clone());
        swap.is_claimed = true;
        self.swaps.insert(&swap_id, &swap);

        let amount: u128 = swap.amount.into();
        let fee = amount * self.fee_rate / 10000;
        let payout = amount - fee;

        // Emit event
        env::log_str(&serde_json::to_string(&SwapClaimedEvent {
            swap_id: swap_id.clone(),
            claimer: claimer.clone(),
            secret,
            amount: U128(payout),
        }).unwrap());

        // Transfer funds to receiver
        Promise::new(claimer).transfer(payout)
    }

    /// Refund the swap after timelock expires
    pub fn refund_swap(&mut self, swap_id: String) -> Promise {
        let refunder = env::predecessor_account_id();
        let mut swap = self.swaps.get(&swap_id).expect("Swap not found");
        
        require!(!swap.is_claimed, "Swap already claimed");
        require!(!swap.is_refunded, "Swap already refunded");
        require!(env::block_timestamp() >= swap.timelock, "Swap not expired yet");
        
        // Only sender can refund
        require!(refunder == swap.sender, "Only sender can refund");

        swap.is_refunded = true;
        self.swaps.insert(&swap_id, &swap);

        let amount: u128 = swap.amount.into();

        // Emit event
        env::log_str(&serde_json::to_string(&SwapRefundedEvent {
            swap_id: swap_id.clone(),
            refunder: refunder.clone(),
            amount: U128(amount),
        }).unwrap());

        // Refund to sender
        Promise::new(refunder).transfer(amount)
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

    /// Check if a secret is valid for a given hashlock
    pub fn verify_secret(&self, secret: String, hashlock: String) -> bool {
        self.hash_secret(&secret) == hashlock
    }

    /// Owner functions
    pub fn set_fee_rate(&mut self, new_rate: u128) {
        require!(env::predecessor_account_id() == self.owner, "Only owner can set fee");
        require!(new_rate <= 1000, "Fee rate cannot exceed 10%"); // Max 10%
        self.fee_rate = new_rate;
    }

    pub fn withdraw_fees(&mut self) -> Promise {
        require!(env::predecessor_account_id() == self.owner, "Only owner can withdraw");
        let balance = env::account_balance();
        let available = balance - env::account_locked_balance();
        Promise::new(self.owner.clone()).transfer(available)
    }

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
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, MockedBlockchain};

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
        
        // Claim swap
        context.predecessor_account_id(accounts(1));
        testing_env!(context.build());
        
        contract.claim_swap(swap_id.clone(), secret.to_string());
        
        // Verify swap claimed
        let swap = contract.get_swap(swap_id).unwrap();
        assert!(swap.is_claimed);
        assert_eq!(swap.secret, Some(secret.to_string()));
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
    }
}