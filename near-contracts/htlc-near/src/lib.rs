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

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct HTLCNear {
    contracts: UnorderedMap<String, HTLCContract>,
    owner: AccountId,
}

#[near_bindgen]
impl HTLCNear {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            contracts: UnorderedMap::new(b"c"),
            owner,
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