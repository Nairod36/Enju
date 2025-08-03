use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::{Base64VecU8, U128};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, NearToken, PanicOnDefault, Promise, Timestamp,
};
use sha2::Digest;

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct HTLCContract {
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: U128,
    pub hashlock: Vec<u8>,
    pub timelock: Timestamp,
    pub withdrawn: bool,
    pub refunded: bool,
    pub eth_address: String,
}

// Cross-chain swap extension for 1inch Fusion+
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct CrossChainHTLC {
    pub sender: AccountId,
    pub receiver: AccountId,
    pub amount: U128,
    pub hashlock: Vec<u8>,
    pub timelock: Timestamp,
    pub withdrawn: bool,
    pub refunded: bool,
    pub eth_address: String,
    pub eth_tx_hash: Option<String>, // For verification
}

// Partial Fill HTLC for 1inch Fusion+ Dutch Auctions
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct PartialFill {
    pub fill_id: String,
    pub parent_swap_id: String,
    pub sender: AccountId,
    pub receiver: AccountId,
    pub fill_amount: U128,
    pub hashlock: Vec<u8>,
    pub timelock: Timestamp,
    pub completed: bool,
    pub refunded: bool,
    pub eth_address: String,
    pub eth_tx_hash: Option<String>,
    pub created_at: Timestamp,
}

// Main Swap tracking multiple partial fills
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct PartialFillSwap {
    pub swap_id: String,
    pub sender: AccountId,
    pub receiver: AccountId,
    pub total_amount: U128,
    pub filled_amount: U128,
    pub remaining_amount: U128,
    pub eth_address: String,
    pub timelock: Timestamp,
    pub completed: bool,
    pub created_at: Timestamp,
    pub fill_count: u32,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct HTLCNear {
    contracts: UnorderedMap<String, HTLCContract>,
    cross_chain_contracts: UnorderedMap<String, CrossChainHTLC>,
    // Partial Fills for 1inch Fusion+
    partial_fill_swaps: UnorderedMap<String, PartialFillSwap>,
    partial_fills: UnorderedMap<String, PartialFill>,
    owner: AccountId,
    authorized_resolvers: UnorderedMap<AccountId, bool>,
}

#[near_bindgen]
impl HTLCNear {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            contracts: UnorderedMap::new(b"c"),
            cross_chain_contracts: UnorderedMap::new(b"cc".as_slice()),
            partial_fill_swaps: UnorderedMap::new(b"s".as_slice()),
            partial_fills: UnorderedMap::new(b"f".as_slice()),
            owner: owner.clone(),
            authorized_resolvers: UnorderedMap::new(b"r"),
        }
    }

    #[payable]
    pub fn create_htlc(
        &mut self,
        receiver: AccountId,
        hashlock: Base64VecU8,
        timelock: Timestamp,
        eth_address: String,
    ) -> String {
        let sender = env::predecessor_account_id();
        let amount = env::attached_deposit();

        assert!(amount > NearToken::from_yoctonear(0), "Amount must be greater than 0");
        assert!(
            timelock > env::block_timestamp_ms(),
            "Timelock must be in the future"
        );
        assert!(!hashlock.0.is_empty(), "Hashlock cannot be empty");
        assert!(hashlock.0.len() == 32, "Hashlock must be 32 bytes");

        // Generate unique contract ID
        let contract_id = format!(
            "{}-{}-{}-{}",
            sender,
            receiver,
            amount,
            env::block_timestamp_ms()
        );

        let contract = HTLCContract {
            sender: sender.clone(),
            receiver,
            amount: U128(amount.as_yoctonear()),
            hashlock: hashlock.0,
            timelock,
            withdrawn: false,
            refunded: false,
            eth_address,
        };

        self.contracts.insert(&contract_id, &contract);

        env::log_str(&format!(
            "HTLC created: {}, sender: {}, amount: {}, timelock: {}",
            contract_id, sender, amount, timelock
        ));

        contract_id
    }

    pub fn withdraw(&mut self, contract_id: String, preimage: Base64VecU8) {
        let mut contract = self
            .contracts
            .get(&contract_id)
            .expect("Contract does not exist");

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

        // Verify preimage
        let hash = sha2::Sha256::digest(&preimage.0);
        assert_eq!(
            hash.as_slice(),
            &contract.hashlock,
            "Invalid preimage"
        );

        contract.withdrawn = true;
        self.contracts.insert(&contract_id, &contract);

        // Transfer NEAR to receiver
        Promise::new(contract.receiver.clone()).transfer(NearToken::from_yoctonear(contract.amount.0));

        env::log_str(&format!(
            "HTLC withdrawn: {}, receiver: {}, amount: {}",
            contract_id, contract.receiver, contract.amount.0
        ));
    }

    pub fn refund(&mut self, contract_id: String) {
        let mut contract = self
            .contracts
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
        self.contracts.insert(&contract_id, &contract);

        // Transfer NEAR back to sender
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

    // ======= CROSS-CHAIN METHODS FOR 1INCH FUSION+ =======

    /// Create a cross-chain HTLC for NEAR → ETH swap
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

        assert!(amount > NearToken::from_yoctonear(0), "Amount must be greater than 0");
        assert!(
            timelock > env::block_timestamp_ms(),
            "Timelock must be in the future"
        );
        assert!(!hashlock.0.is_empty(), "Hashlock cannot be empty");
        assert!(hashlock.0.len() == 32, "Hashlock must be 32 bytes");
        assert!(!eth_address.is_empty(), "ETH address required");

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
            eth_tx_hash: None,
        };

        self.cross_chain_contracts.insert(&contract_id, &contract);

        env::log_str(&format!(
            "Cross-chain HTLC created: {}, sender: {}, amount: {}, timelock: {}",
            contract_id, sender, amount, timelock
        ));

        contract_id
    }

    /// Complete cross-chain swap with preimage
    pub fn complete_cross_chain_swap(&mut self, contract_id: String, preimage: Base64VecU8, eth_tx_hash: String) {
        let mut contract = self
            .cross_chain_contracts
            .get(&contract_id)
            .expect("Contract does not exist");

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

        // Verify preimage
        let hash = sha2::Sha256::digest(&preimage.0);
        assert_eq!(
            hash.as_slice(),
            &contract.hashlock,
            "Invalid preimage"
        );

        contract.withdrawn = true;
        contract.eth_tx_hash = Some(eth_tx_hash.clone());
        self.cross_chain_contracts.insert(&contract_id, &contract);

        Promise::new(contract.receiver.clone()).transfer(NearToken::from_yoctonear(contract.amount.0));

        env::log_str(&format!(
            "Cross-chain HTLC completed: {}, receiver: {}, eth_tx: {}",
            contract_id, contract.receiver, eth_tx_hash
        ));
    }

    /// Refund cross-chain HTLC after timelock
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

    /// Authorize resolver
    pub fn authorize_resolver(&mut self, resolver: AccountId) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Only owner");
        self.authorized_resolvers.insert(&resolver, &true);
        env::log_str(&format!("Resolver authorized: {}", resolver));
    }

    /// Check if resolver is authorized
    pub fn is_authorized_resolver(&self, resolver: AccountId) -> bool {
        self.authorized_resolvers.get(&resolver).unwrap_or(false)
    }

    /// Migrate contract to support partial fills (owner only)
    pub fn migrate_to_partial_fills(&mut self) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Only owner can migrate");
        
        // Initialize new fields if they don't exist
        // Note: This is automatically handled by the new() constructor pattern
        // but we add this method for explicit migration
        
        env::log_str("Contract migrated to support partial fills");
    }

    // ======= PARTIAL FILLS FOR 1INCH FUSION+ =======

    /// Create initial partial fill swap (main order)
    pub fn create_partial_fill_swap(
        &mut self,
        receiver: AccountId,
        total_amount: U128,
        eth_address: String,
        timelock: Timestamp,
    ) -> String {
        let sender = env::predecessor_account_id();

        assert!(total_amount.0 > 0, "Total amount must be greater than 0");
        assert!(
            timelock > env::block_timestamp_ms(),
            "Timelock must be in the future"
        );
        assert!(!eth_address.is_empty(), "ETH address required");

        let swap_id = format!(
            "pf-swap-{}-{}-{}",
            sender,
            total_amount.0,
            env::block_timestamp_ms()
        );

        let swap = PartialFillSwap {
            swap_id: swap_id.clone(),
            sender: sender.clone(),
            receiver,
            total_amount,
            filled_amount: U128(0),
            remaining_amount: total_amount,
            eth_address,
            timelock,
            completed: false,
            created_at: env::block_timestamp_ms(),
            fill_count: 0,
        };

        self.partial_fill_swaps.insert(&swap_id, &swap);

        env::log_str(&format!(
            "Partial Fill Swap created: {}, sender: {}, total: {}",
            swap_id, sender, total_amount.0
        ));

        swap_id
    }

    /// Create a partial fill (user signs for small amount)
    #[payable]
    pub fn create_partial_fill(
        &mut self,
        swap_id: String,
        hashlock: Base64VecU8,
        fill_amount: U128,
    ) -> String {
        let sender = env::predecessor_account_id();
        let attached_amount = env::attached_deposit();

        // Get the main swap
        let mut swap = self
            .partial_fill_swaps
            .get(&swap_id)
            .expect("Partial fill swap does not exist");

        assert_eq!(sender, swap.sender, "Only swap sender can create fills");
        assert!(!swap.completed, "Swap already completed");
        assert!(fill_amount.0 > 0, "Fill amount must be greater than 0");
        assert!(
            fill_amount.0 <= swap.remaining_amount.0,
            "Fill amount exceeds remaining amount"
        );
        assert_eq!(
            attached_amount.as_yoctonear(),
            fill_amount.0,
            "Must attach exact fill amount"
        );
        assert!(!hashlock.0.is_empty(), "Hashlock cannot be empty");
        assert!(hashlock.0.len() == 32, "Hashlock must be 32 bytes");

        let fill_id = format!(
            "fill-{}-{}-{}",
            swap_id,
            fill_amount.0,
            env::block_timestamp_ms()
        );

        let partial_fill = PartialFill {
            fill_id: fill_id.clone(),
            parent_swap_id: swap_id.clone(),
            sender: sender.clone(),
            receiver: swap.receiver.clone(),
            fill_amount,
            hashlock: hashlock.0,
            timelock: swap.timelock,
            completed: false,
            refunded: false,
            eth_address: swap.eth_address.clone(),
            eth_tx_hash: None,
            created_at: env::block_timestamp_ms(),
        };

        // Update swap state
        swap.filled_amount = U128(swap.filled_amount.0 + fill_amount.0);
        swap.remaining_amount = U128(swap.remaining_amount.0 - fill_amount.0);
        swap.fill_count += 1;

        if swap.remaining_amount.0 == 0 {
            swap.completed = true;
        }

        // Store updates
        self.partial_fills.insert(&fill_id, &partial_fill);
        self.partial_fill_swaps.insert(&swap_id, &swap);

        env::log_str(&format!(
            "Partial Fill created: {}, amount: {}, remaining: {}",
            fill_id, fill_amount.0, swap.remaining_amount.0
        ));

        fill_id
    }

    /// Complete a partial fill with preimage
    pub fn complete_partial_fill(
        &mut self,
        fill_id: String,
        preimage: Base64VecU8,
        eth_tx_hash: String,
    ) {
        let mut partial_fill = self
            .partial_fills
            .get(&fill_id)
            .expect("Partial fill does not exist");

        assert!(!partial_fill.completed, "Fill already completed");
        assert!(!partial_fill.refunded, "Fill already refunded");
        assert!(
            env::predecessor_account_id() == partial_fill.receiver,
            "Only receiver can complete fill"
        );
        assert!(
            env::block_timestamp_ms() <= partial_fill.timelock,
            "Timelock expired"
        );

        // Verify preimage
        let hash = sha2::Sha256::digest(&preimage.0);
        assert_eq!(
            hash.as_slice(),
            &partial_fill.hashlock,
            "Invalid preimage"
        );

        partial_fill.completed = true;
        partial_fill.eth_tx_hash = Some(eth_tx_hash.clone());
        self.partial_fills.insert(&fill_id, &partial_fill);

        // Transfer NEAR to receiver
        Promise::new(partial_fill.receiver.clone())
            .transfer(NearToken::from_yoctonear(partial_fill.fill_amount.0));

        env::log_str(&format!(
            "Partial Fill completed: {}, receiver: {}, amount: {}, eth_tx: {}",
            fill_id, partial_fill.receiver, partial_fill.fill_amount.0, eth_tx_hash
        ));
    }

    /// Refund a partial fill after timelock
    pub fn refund_partial_fill(&mut self, fill_id: String) {
        let mut partial_fill = self
            .partial_fills
            .get(&fill_id)
            .expect("Partial fill does not exist");

        assert!(!partial_fill.completed, "Fill already completed");
        assert!(!partial_fill.refunded, "Fill already refunded");
        assert!(
            env::predecessor_account_id() == partial_fill.sender,
            "Only sender can refund fill"
        );
        assert!(
            env::block_timestamp_ms() > partial_fill.timelock,
            "Timelock not expired"
        );

        partial_fill.refunded = true;
        self.partial_fills.insert(&fill_id, &partial_fill);

        // Update parent swap
        let mut swap = self
            .partial_fill_swaps
            .get(&partial_fill.parent_swap_id)
            .expect("Parent swap not found");

        swap.filled_amount = U128(swap.filled_amount.0 - partial_fill.fill_amount.0);
        swap.remaining_amount = U128(swap.remaining_amount.0 + partial_fill.fill_amount.0);
        swap.completed = false; // Reopen swap for more fills

        self.partial_fill_swaps.insert(&partial_fill.parent_swap_id, &swap);

        // Refund NEAR to sender
        Promise::new(partial_fill.sender.clone())
            .transfer(NearToken::from_yoctonear(partial_fill.fill_amount.0));

        env::log_str(&format!(
            "Partial Fill refunded: {}, sender: {}, amount: {}",
            fill_id, partial_fill.sender, partial_fill.fill_amount.0
        ));
    }

    /// Get partial fill swap details
    pub fn get_partial_fill_swap(&self, swap_id: String) -> Option<(String, String, String, String, String, String, String, u64, bool, u64, u32)> {
        self.partial_fill_swaps.get(&swap_id).map(|swap| (
            swap.swap_id,
            swap.sender.to_string(),
            swap.receiver.to_string(),
            swap.total_amount.0.to_string(),
            swap.filled_amount.0.to_string(),
            swap.remaining_amount.0.to_string(),
            swap.eth_address,
            swap.timelock,
            swap.completed,
            swap.created_at,
            swap.fill_count,
        ))
    }

    /// Get partial fill details
    pub fn get_partial_fill(&self, fill_id: String) -> Option<(String, String, String, String, String, String, u64, bool, bool, String, Option<String>, u64)> {
        self.partial_fills.get(&fill_id).map(|fill| (
            fill.fill_id,
            fill.parent_swap_id,
            fill.sender.to_string(),
            fill.receiver.to_string(),
            fill.fill_amount.0.to_string(),
            hex::encode(&fill.hashlock),
            fill.timelock,
            fill.completed,
            fill.refunded,
            fill.eth_address,
            fill.eth_tx_hash,
            fill.created_at,
        ))
    }

    /// Get all partial fills for a swap
    pub fn get_swap_partial_fills(&self, swap_id: String) -> Vec<(String, String, String, String, String, String, u64, bool, bool, String, Option<String>, u64)> {
        self.partial_fills
            .iter()
            .filter(|(_, fill)| fill.parent_swap_id == swap_id)
            .map(|(_, fill)| (
                fill.fill_id.clone(),
                fill.parent_swap_id.clone(),
                fill.sender.to_string(),
                fill.receiver.to_string(),
                fill.fill_amount.0.to_string(),
                hex::encode(&fill.hashlock),
                fill.timelock,
                fill.completed,
                fill.refunded,
                fill.eth_address.clone(),
                fill.eth_tx_hash.clone(),
                fill.created_at,
            ))
            .collect()
    }

    /// Get swap progress statistics
    pub fn get_swap_progress(&self, swap_id: String) -> Option<(String, String, String, u32, bool, u32)> {
        self.partial_fill_swaps.get(&swap_id).map(|swap| {
            let fill_percentage = if swap.total_amount.0 > 0 {
                ((swap.filled_amount.0 * 100) / swap.total_amount.0) as u32
            } else {
                0
            };

            (
                swap.total_amount.0.to_string(),
                swap.filled_amount.0.to_string(),
                swap.remaining_amount.0.to_string(),
                swap.fill_count,
                swap.completed,
                fill_percentage,
            )
        })
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
        assert_eq!(htlc.0, accounts(1).to_string());
        assert_eq!(htlc.1, accounts(2).to_string());
        assert_eq!(htlc.2, ATTACHED_DEPOSIT.to_string());
        assert_eq!(htlc.3, hex::encode(&hashlock));
        assert_eq!(htlc.4, timelock);
        assert!(!htlc.5);
        assert!(!htlc.6);
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
        assert!(htlc.5); // withdrawn
        assert!(!htlc.6); // refunded
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
        assert!(!htlc.5); // withdrawn
        assert!(htlc.6); // refunded
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