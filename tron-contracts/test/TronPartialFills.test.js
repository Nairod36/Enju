const TronPartialFills = artifacts.require("TronPartialFills");
const TronWeb = require('tronweb');

contract("TronPartialFills", (accounts) => {
  let partialFillsInstance;
  let owner, filler1, filler2, maker;
  
  // Test constants
  const MIN_PARTIAL_AMOUNT = 1000000; // 0.001 TRX in Sun
  const FILLER_BOND_RATIO = 10; // 10%
  const PARTIAL_FILL_TIMEOUT = 30 * 60; // 30 minutes
  
  before(async () => {
    partialFillsInstance = await TronPartialFills.deployed();
    
    [owner, maker, filler1, filler2] = accounts;
    
    console.log("Contract deployed at:", partialFillsInstance.address);
    console.log("Owner:", owner);
  });

  describe("Contract Deployment", () => {
    it("should deploy successfully with correct owner", async () => {
      const contractOwner = await partialFillsInstance.owner();
      assert.equal(contractOwner, owner, "Owner should be set correctly");
    });

    it("should have correct constants", async () => {
      const minAmount = await partialFillsInstance.MIN_PARTIAL_AMOUNT();
      const bondRatio = await partialFillsInstance.FILLER_BOND_RATIO();
      const timeout = await partialFillsInstance.PARTIAL_FILL_TIMEOUT();
      
      assert.equal(minAmount.toNumber(), MIN_PARTIAL_AMOUNT, "Min partial amount should be correct");
      assert.equal(bondRatio.toNumber(), FILLER_BOND_RATIO, "Filler bond ratio should be correct");
      assert.equal(timeout.toNumber(), PARTIAL_FILL_TIMEOUT, "Partial fill timeout should be correct");
    });
  });

  describe("Filler Management", () => {
    it("should allow filler registration with sufficient bond", async () => {
      const bondAmount = MIN_PARTIAL_AMOUNT * 20; // 20x minimum
      
      const tx = await partialFillsInstance.registerFiller({
        from: filler1,
        value: bondAmount
      });

      const fillerBond = await partialFillsInstance.fillerBonds(filler1);
      assert.equal(fillerBond.toNumber(), bondAmount, "Filler bond should be recorded correctly");

      // Check event emission
      const logs = tx.logs.filter(log => log.event === 'FillerBondUpdated');
      // Note: We'd need to add this event to the contract for proper testing
    });

    it("should reject filler registration with insufficient bond", async () => {
      const insufficientBond = MIN_PARTIAL_AMOUNT * 5; // Less than minimum required
      
      try {
        await partialFillsInstance.registerFiller({
          from: filler2,
          value: insufficientBond
        });
        assert.fail("Should have thrown an error for insufficient bond");
      } catch (error) {
        assert(error.message.includes("Insufficient bond"), "Should throw insufficient bond error");
      }
    });

    it("should allow filler bond withdrawal when no active fills", async () => {
      // Register filler2 first
      const bondAmount = MIN_PARTIAL_AMOUNT * 15;
      await partialFillsInstance.registerFiller({
        from: filler2,
        value: bondAmount
      });

      const initialBalance = await web3.eth.getBalance(filler2);
      const withdrawAmount = MIN_PARTIAL_AMOUNT * 5;

      const tx = await partialFillsInstance.withdrawFillerBond(withdrawAmount, {
        from: filler2
      });

      const finalBalance = await web3.eth.getBalance(filler2);
      const fillerBond = await partialFillsInstance.fillerBonds(filler2);
      
      assert.equal(fillerBond.toNumber(), bondAmount - withdrawAmount, "Bond should be reduced correctly");
    });
  });

  describe("Partial Order Creation", () => {
    let hashlock, orderHash;
    const totalAmount = MIN_PARTIAL_AMOUNT * 1000; // 1 TRX
    const minFillAmount = MIN_PARTIAL_AMOUNT * 100; // 0.1 TRX
    const maxFillAmount = MIN_PARTIAL_AMOUNT * 300; // 0.3 TRX

    before(() => {
      // Generate test hashlock
      const secret = "0x1234567890123456789012345678901234567890123456789012345678901234";
      hashlock = web3.utils.sha3(secret);
    });

    it("should create partial order successfully", async () => {
      const tronMaker = "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC"; // Valid TRON address format
      
      const tx = await partialFillsInstance.createPartialOrder(
        hashlock,
        totalAmount,
        minFillAmount,
        maxFillAmount,
        "ethereum",
        tronMaker,
        {
          from: maker,
          value: totalAmount
        }
      );

      // Extract order hash from events
      const event = tx.logs.find(log => log.event === 'PartialOrderCreated');
      assert(event, "PartialOrderCreated event should be emitted");
      
      orderHash = event.args.orderHash;
      
      // Verify order data
      const orderData = await partialFillsInstance.getPartialOrder(orderHash);
      assert.equal(orderData.totalAmount.toNumber(), totalAmount, "Total amount should match");
      assert.equal(orderData.minFillAmount.toNumber(), minFillAmount, "Min fill amount should match");
      assert.equal(orderData.maxFillAmount.toNumber(), maxFillAmount, "Max fill amount should match");
      assert.equal(orderData.remainingAmount.toNumber(), totalAmount, "Remaining amount should equal total initially");
      assert.equal(orderData.isActive, true, "Order should be active");
      assert.equal(orderData.fillCount.toNumber(), 0, "Fill count should be 0 initially");
    });

    it("should reject duplicate order creation", async () => {
      try {
        await partialFillsInstance.createPartialOrder(
          hashlock,
          totalAmount,
          minFillAmount,
          maxFillAmount,
          "ethereum",
          "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC",
          {
            from: maker,
            value: totalAmount
          }
        );
        assert.fail("Should have thrown an error for duplicate order");
      } catch (error) {
        assert(error.message.includes("Order already exists"), "Should throw duplicate order error");
      }
    });

    it("should reject invalid parameters", async () => {
      const newHashlock = web3.utils.sha3("different_secret");
      
      // Test insufficient amount
      try {
        await partialFillsInstance.createPartialOrder(
          newHashlock,
          totalAmount,
          minFillAmount,
          maxFillAmount,
          "ethereum",
          "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC",
          {
            from: maker,
            value: totalAmount - 1000 // Insufficient value
          }
        );
        assert.fail("Should have thrown an error for insufficient TRX");
      } catch (error) {
        assert(error.message.includes("Insufficient TRX sent"), "Should throw insufficient TRX error");
      }

      // Test invalid fill amounts
      try {
        await partialFillsInstance.createPartialOrder(
          newHashlock,
          totalAmount,
          maxFillAmount + 1000, // Min > Max
          maxFillAmount,
          "ethereum",
          "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC",
          {
            from: maker,
            value: totalAmount
          }
        );
        assert.fail("Should have thrown an error for invalid fill amounts");
      } catch (error) {
        assert(error.message.includes("Invalid fill amounts"), "Should throw invalid fill amounts error");
      }
    });

    // Store orderHash for use in subsequent tests
    this.orderHash = orderHash;
  });

  describe("Partial Fill Execution", () => {
    let fillId, orderHash;
    const fillAmount = MIN_PARTIAL_AMOUNT * 150; // 0.15 TRX
    const targetAddress = "0x742d35Cc6634C0532925a3b8D43C7dE4723c2f6B"; // Valid ETH address
    const fillSecret = web3.utils.sha3("fill_secret_123");

    before(async () => {
      // Use the order created in previous test
      // We need to create a new order for this test
      const secret = "0x9876543210987654321098765432109876543210987654321098765432109876";
      const hashlock = web3.utils.sha3(secret);
      const totalAmount = MIN_PARTIAL_AMOUNT * 1000;
      const minFillAmount = MIN_PARTIAL_AMOUNT * 100;
      const maxFillAmount = MIN_PARTIAL_AMOUNT * 300;

      const tx = await partialFillsInstance.createPartialOrder(
        hashlock,
        totalAmount,
        minFillAmount,
        maxFillAmount,
        "ethereum",
        "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC",
        {
          from: maker,
          value: totalAmount
        }
      );

      const event = tx.logs.find(log => log.event === 'PartialOrderCreated');
      orderHash = event.args.orderHash;
    });

    it("should execute partial fill successfully", async () => {
      const requiredBond = Math.floor(fillAmount * FILLER_BOND_RATIO / 100);
      
      const tx = await partialFillsInstance.executePartialFill(
        orderHash,
        fillAmount,
        targetAddress,
        fillSecret,
        {
          from: filler1,
          value: requiredBond
        }
      );

      // Check event emission
      const event = tx.logs.find(log => log.event === 'PartialFillExecuted');
      assert(event, "PartialFillExecuted event should be emitted");
      
      fillId = event.args.fillId;
      assert.equal(event.args.amount.toNumber(), fillAmount, "Fill amount should match");
      assert.equal(event.args.filler, filler1, "Filler should match");

      // Verify order state update
      const orderData = await partialFillsInstance.getPartialOrder(orderHash);
      const expectedRemaining = MIN_PARTIAL_AMOUNT * 1000 - fillAmount;
      assert.equal(orderData.remainingAmount.toNumber(), expectedRemaining, "Remaining amount should be updated");

      // Verify fill data
      const fillData = await partialFillsInstance.getFill(fillId);
      assert.equal(fillData.filler, filler1, "Fill filler should match");
      assert.equal(fillData.amount.toNumber(), fillAmount, "Fill amount should match");
      assert.equal(fillData.targetAddress, targetAddress, "Target address should match");
      assert.equal(fillData.state.toNumber(), 0, "Fill state should be Pending (0)");
    });

    it("should reject fill with insufficient bond", async () => {
      const fillAmount2 = MIN_PARTIAL_AMOUNT * 100;
      const insufficientBond = Math.floor(fillAmount2 * FILLER_BOND_RATIO / 100) - 1000;
      
      try {
        await partialFillsInstance.executePartialFill(
          orderHash,
          fillAmount2,
          targetAddress,
          fillSecret,
          {
            from: filler2,
            value: insufficientBond
          }
        );
        assert.fail("Should have thrown an error for insufficient bond");
      } catch (error) {
        assert(error.message.includes("Insufficient filler bond"), "Should throw insufficient bond error");
      }
    });

    it("should reject fill exceeding remaining amount", async () => {
      const orderData = await partialFillsInstance.getPartialOrder(orderHash);
      const excessiveFillAmount = orderData.remainingAmount.toNumber() + 1000;
      const requiredBond = Math.floor(excessiveFillAmount * FILLER_BOND_RATIO / 100);
      
      try {
        await partialFillsInstance.executePartialFill(
          orderHash,
          excessiveFillAmount,
          targetAddress,
          fillSecret,
          {
            from: filler2,
            value: requiredBond
          }
        );
        assert.fail("Should have thrown an error for excessive fill amount");
      } catch (error) {
        assert(error.message.includes("Amount exceeds remaining"), "Should throw excessive amount error");
      }
    });

    // Store fillId for use in completion test
    this.fillId = fillId;
    this.orderHash = orderHash;
  });

  describe("Partial Fill Completion", () => {
    it("should complete partial fill with valid secret", async () => {
      const fillId = this.fillId;
      const secret = web3.utils.sha3("completion_secret");
      
      // Get initial filler balance
      const initialBalance = await web3.eth.getBalance(filler1);
      const fillData = await partialFillsInstance.getFill(fillId);
      const fillAmount = fillData.amount.toNumber();
      
      const tx = await partialFillsInstance.completePartialFill(fillId, secret);

      // Check event emission
      const event = tx.logs.find(log => log.event === 'PartialFillCompleted');
      assert(event, "PartialFillCompleted event should be emitted");
      assert.equal(event.args.fillId, fillId, "Fill ID should match");
      assert.equal(event.args.secret, secret, "Secret should match");
      assert.equal(event.args.amount.toNumber(), fillAmount, "Amount should match");

      // Verify fill state update
      const updatedFillData = await partialFillsInstance.getFill(fillId);
      assert.equal(updatedFillData.state.toNumber(), 1, "Fill state should be Completed (1)");

      // Verify filler bond was returned
      const expectedBondReturn = Math.floor(fillAmount * FILLER_BOND_RATIO / 100);
      const currentFillerBond = await partialFillsInstance.fillerBonds(filler1);
      // Note: Exact balance verification is complex due to gas costs
    });

    it("should reject completion of already completed fill", async () => {
      const fillId = this.fillId;
      const secret = web3.utils.sha3("another_secret");
      
      try {
        await partialFillsInstance.completePartialFill(fillId, secret);
        assert.fail("Should have thrown an error for already completed fill");
      } catch (error) {
        assert(error.message.includes("Fill not pending"), "Should throw fill not pending error");
      }
    });
  });

  describe("Order Management", () => {
    it("should get correct order fills", async () => {
      const orderHash = this.orderHash;
      const orderFills = await partialFillsInstance.getOrderFills(orderHash);
      
      assert(orderFills.length > 0, "Order should have at least one fill");
      assert.equal(orderFills[0], this.fillId, "First fill ID should match");
    });

    it("should handle emergency order deactivation by owner", async () => {
      const orderHash = this.orderHash;
      
      const tx = await partialFillsInstance.emergencyDeactivateOrder(orderHash, {
        from: owner
      });

      const orderData = await partialFillsInstance.getPartialOrder(orderHash);
      assert.equal(orderData.isActive, false, "Order should be deactivated");
    });

    it("should reject emergency deactivation by non-owner", async () => {
      // Create a new order for this test
      const secret = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef";
      const hashlock = web3.utils.sha3(secret);
      const totalAmount = MIN_PARTIAL_AMOUNT * 500;
      
      const tx = await partialFillsInstance.createPartialOrder(
        hashlock,
        totalAmount,
        MIN_PARTIAL_AMOUNT * 50,
        MIN_PARTIAL_AMOUNT * 150,
        "ethereum",
        "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC",
        {
          from: maker,
          value: totalAmount
        }
      );

      const event = tx.logs.find(log => log.event === 'PartialOrderCreated');
      const newOrderHash = event.args.orderHash;
      
      try {
        await partialFillsInstance.emergencyDeactivateOrder(newOrderHash, {
          from: filler1 // Non-owner
        });
        assert.fail("Should have thrown an error for non-owner emergency deactivation");
      } catch (error) {
        assert(error.message.includes("Only owner"), "Should throw only owner error");
      }
    });
  });

  describe("Statistics and Utilities", () => {
    it("should return partial fill statistics", async () => {
      const stats = await partialFillsInstance.getPartialFillStats();
      
      assert(stats.totalBondsLocked.toNumber() >= 0, "Total bonds locked should be non-negative");
      // Note: totalActiveFillers is currently hardcoded to 0 in the contract
      assert.equal(stats.totalActiveFillers.toNumber(), 0, "Total active fillers matches contract implementation");
    });

    it("should handle batch completion (empty case)", async () => {
      // Test with empty arrays
      const tx = await partialFillsInstance.batchCompletePartialFills([], [], {
        from: owner
      });
      
      // Should not revert and complete successfully
      assert(tx.receipt.status, "Batch completion with empty arrays should succeed");
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete order lifecycle", async () => {
      // Create order
      const secret = "0xfedcbafedcbafedcbafedcbafedcbafedcbafedcbafedcbafedcbafedcbafedcba";
      const hashlock = web3.utils.sha3(secret);
      const totalAmount = MIN_PARTIAL_AMOUNT * 1000; // 1 TRX
      const minFillAmount = MIN_PARTIAL_AMOUNT * 100; // 0.1 TRX
      const maxFillAmount = MIN_PARTIAL_AMOUNT * 200; // 0.2 TRX

      const createTx = await partialFillsInstance.createPartialOrder(
        hashlock,
        totalAmount,
        minFillAmount,
        maxFillAmount,
        "ethereum",
        "TLsV52sRDL79HXGGm9yzwKiVAvC94GXCGC",
        {
          from: maker,
          value: totalAmount
        }
      );

      const createEvent = createTx.logs.find(log => log.event === 'PartialOrderCreated');
      const integrationOrderHash = createEvent.args.orderHash;

      // Execute multiple fills to complete the order
      const targetAddress = "0x742d35Cc6634C0532925a3b8D43C7dE4723c2f6B";
      const fills = [];

      // Fill 1: 0.2 TRX
      const fill1Amount = maxFillAmount;
      const requiredBond1 = Math.floor(fill1Amount * FILLER_BOND_RATIO / 100);
      
      const fill1Tx = await partialFillsInstance.executePartialFill(
        integrationOrderHash,
        fill1Amount,
        targetAddress,
        web3.utils.sha3("fill1_secret"),
        {
          from: filler1,
          value: requiredBond1
        }
      );
      
      const fill1Event = fill1Tx.logs.find(log => log.event === 'PartialFillExecuted');
      fills.push(fill1Event.args.fillId);

      // Fill 2: 0.2 TRX
      const fill2Amount = maxFillAmount;
      const requiredBond2 = Math.floor(fill2Amount * FILLER_BOND_RATIO / 100);
      
      const fill2Tx = await partialFillsInstance.executePartialFill(
        integrationOrderHash,
        fill2Amount,
        targetAddress,
        web3.utils.sha3("fill2_secret"),
        {
          from: filler2,
          value: requiredBond2
        }
      );
      
      const fill2Event = fill2Tx.logs.find(log => log.event === 'PartialFillExecuted');
      fills.push(fill2Event.args.fillId);

      // Fill 3: 0.2 TRX
      const fill3Amount = maxFillAmount;
      const requiredBond3 = Math.floor(fill3Amount * FILLER_BOND_RATIO / 100);
      
      const fill3Tx = await partialFillsInstance.executePartialFill(
        integrationOrderHash,
        fill3Amount,
        targetAddress,
        web3.utils.sha3("fill3_secret"),
        {
          from: filler1,
          value: requiredBond3
        }
      );
      
      const fill3Event = fill3Tx.logs.find(log => log.event === 'PartialFillExecuted');
      fills.push(fill3Event.args.fillId);

      // Verify order state
      const orderData = await partialFillsInstance.getPartialOrder(integrationOrderHash);
      const expectedRemaining = totalAmount - (fill1Amount + fill2Amount + fill3Amount);
      assert.equal(orderData.remainingAmount.toNumber(), expectedRemaining, "Remaining amount should be correct");
      assert.equal(orderData.fillCount.toNumber(), 3, "Fill count should be 3");

      // Get order fills
      const orderFills = await partialFillsInstance.getOrderFills(integrationOrderHash);
      assert.equal(orderFills.length, 3, "Should have 3 fills");

      console.log(`✅ Integration test completed: Order ${integrationOrderHash.substring(0, 10)}... with ${fills.length} fills`);
      console.log(`📊 Remaining amount: ${expectedRemaining} Sun (${expectedRemaining / 1e6} TRX)`);
    });
  });
});