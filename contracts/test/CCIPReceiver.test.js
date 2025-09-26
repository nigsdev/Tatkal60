import { expect } from "chai";
import { ethers } from "hardhat";

describe("CCIPReceiver", function () {
  let ccipReceiver;
  let escrowGame;
  let oracleAdapter;
  let owner;
  let user1;
  let user2;
  let trustedRouter;
  let trustedSourceChain = 11155111; // Sepolia (fits in uint64)

  beforeEach(async function () {
    [owner, user1, user2, trustedRouter] = await ethers.getSigners();

    // Deploy OracleAdapter
    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy();

    // Deploy EscrowGame
    const EscrowGame = await ethers.getContractFactory("EscrowGame");
    escrowGame = await EscrowGame.deploy(
      await oracleAdapter.getAddress(),
      owner.address, // fee sink
      500 // 5% fee
    );

    // Deploy CCIPReceiver
    const CCIPReceiver = await ethers.getContractFactory("CCIPReceiver");
    ccipReceiver = await CCIPReceiver.deploy(
      trustedRouter.address,
      await escrowGame.getAddress(),
      trustedSourceChain
    );
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await ccipReceiver.owner()).to.equal(owner.address);
    });

    it("Should set the correct trusted router", async function () {
      expect(await ccipReceiver.trustedRouter()).to.equal(trustedRouter.address);
    });

    it("Should set the correct escrow game", async function () {
      expect(await ccipReceiver.escrowGame()).to.equal(await escrowGame.getAddress());
    });

    it("Should set the correct trusted source chain", async function () {
      expect(await ccipReceiver.trustedSourceChain()).to.equal(trustedSourceChain);
    });

    it("Should initialize statistics to zero", async function () {
      const [totalCredits, totalAmount, messageCount] = await ccipReceiver.getStatistics();
      expect(totalCredits).to.equal(0);
      expect(totalAmount).to.equal(0);
      expect(messageCount).to.equal(0);
    });
  });

  describe("Cross-Chain Message Handling", function () {
    it("Should handle valid cross-chain message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-1"));
      const creditAmount = ethers.parseEther("1.0");
      const sourceChain = trustedSourceChain;

      // Create credit message
      const creditMessage = {
        user: user1.address,
        amount: creditAmount,
        sourceChain: sourceChain,
        messageId: messageId
      };

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address user, uint256 amount, uint64 sourceChain, bytes32 messageId)"],
        [creditMessage]
      );

      await expect(
        ccipReceiver.connect(trustedRouter).handleMessage(
          messageId,
          sourceChain,
          data,
          user2.address // sender
        )
      ).to.emit(ccipReceiver, "CreditReceived")
        .withArgs(user1.address, creditAmount, sourceChain, messageId, user2.address);

      // Check statistics
      const [totalCredits, totalAmount, messageCount] = await ccipReceiver.getStatistics();
      expect(totalCredits).to.equal(1);
      expect(totalAmount).to.equal(creditAmount);
      expect(messageCount).to.equal(1);

      // Check user credit count
      const userCreditCount = await ccipReceiver.getUserCreditCount(user1.address);
      expect(userCreditCount).to.equal(1);

      // Check message is marked as processed
      const isProcessed = await ccipReceiver.isMessageProcessed(messageId);
      expect(isProcessed).to.be.true;
    });

    it("Should not allow non-trusted router to handle messages", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-2"));
      const creditAmount = ethers.parseEther("1.0");

      const creditMessage = {
        user: user1.address,
        amount: creditAmount,
        sourceChain: trustedSourceChain,
        messageId: messageId
      };

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address user, uint256 amount, uint64 sourceChain, bytes32 messageId)"],
        [creditMessage]
      );

      await expect(
        ccipReceiver.connect(user1).handleMessage(
          messageId,
          trustedSourceChain,
          data,
          user2.address
        )
      ).to.be.revertedWith("Only trusted router can call this");
    });

    it("Should not allow processing same message twice", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-3"));
      const creditAmount = ethers.parseEther("1.0");

      const creditMessage = {
        user: user1.address,
        amount: creditAmount,
        sourceChain: trustedSourceChain,
        messageId: messageId
      };

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address user, uint256 amount, uint64 sourceChain, bytes32 messageId)"],
        [creditMessage]
      );

      // First processing should succeed
      await ccipReceiver.connect(trustedRouter).handleMessage(
        messageId,
        trustedSourceChain,
        data,
        user2.address
      );

      // Second processing should fail
      await expect(
        ccipReceiver.connect(trustedRouter).handleMessage(
          messageId,
          trustedSourceChain,
          data,
          user2.address
        )
      ).to.be.revertedWith("Message already processed");
    });

    it("Should not allow messages from wrong source chain", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-4"));
      const creditAmount = ethers.parseEther("1.0");
      const wrongSourceChain = 999999999; // Wrong chain ID

      const creditMessage = {
        user: user1.address,
        amount: creditAmount,
        sourceChain: wrongSourceChain,
        messageId: messageId
      };

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address user, uint256 amount, uint64 sourceChain, bytes32 messageId)"],
        [creditMessage]
      );

      await expect(
        ccipReceiver.connect(trustedRouter).handleMessage(
          messageId,
          wrongSourceChain,
          data,
          user2.address
        )
      ).to.be.revertedWith("Invalid source chain");
    });

    it("Should validate message data", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-5"));

      // Test with invalid user address
      const invalidCreditMessage = {
        user: ethers.ZeroAddress,
        amount: ethers.parseEther("1.0"),
        sourceChain: trustedSourceChain,
        messageId: messageId
      };

      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address user, uint256 amount, uint64 sourceChain, bytes32 messageId)"],
        [invalidCreditMessage]
      );

      await expect(
        ccipReceiver.connect(trustedRouter).handleMessage(
          messageId,
          trustedSourceChain,
          data,
          user2.address
        )
      ).to.be.revertedWith("Invalid user address");

      // Test with zero amount
      const zeroAmountMessage = {
        user: user1.address,
        amount: 0,
        sourceChain: trustedSourceChain,
        messageId: messageId
      };

      const zeroData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["tuple(address user, uint256 amount, uint64 sourceChain, bytes32 messageId)"],
        [zeroAmountMessage]
      );

      await expect(
        ccipReceiver.connect(trustedRouter).handleMessage(
          messageId,
          trustedSourceChain,
          zeroData,
          user2.address
        )
      ).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Simulation Function", function () {
    it("Should allow owner to simulate cross-chain credit", async function () {
      const creditAmount = ethers.parseEther("2.0");
      const sourceChain = trustedSourceChain;

      await expect(
        ccipReceiver.simulateCrossChainCredit(user1.address, creditAmount, sourceChain)
      ).to.emit(ccipReceiver, "CreditReceived");

      // Check statistics
      const [totalCredits, totalAmount, messageCount] = await ccipReceiver.getStatistics();
      expect(totalCredits).to.equal(1);
      expect(totalAmount).to.equal(creditAmount);
      expect(messageCount).to.equal(1);

      // Check user credit count
      const userCreditCount = await ccipReceiver.getUserCreditCount(user1.address);
      expect(userCreditCount).to.equal(1);
    });

    it("Should not allow non-owner to simulate credits", async function () {
      const creditAmount = ethers.parseEther("1.0");
      const sourceChain = trustedSourceChain;

      await expect(
        ccipReceiver.connect(user1).simulateCrossChainCredit(user2.address, creditAmount, sourceChain)
      ).to.be.revertedWithCustomError(ccipReceiver, "OwnableUnauthorizedAccount");
    });

    it("Should validate simulation parameters", async function () {
      // Test with invalid user address
      await expect(
        ccipReceiver.simulateCrossChainCredit(ethers.ZeroAddress, ethers.parseEther("1.0"), trustedSourceChain)
      ).to.be.revertedWith("Invalid user address");

      // Test with zero amount
      await expect(
        ccipReceiver.simulateCrossChainCredit(user1.address, 0, trustedSourceChain)
      ).to.be.revertedWith("Invalid amount");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update trusted router", async function () {
      const newRouter = user1.address;

      await expect(ccipReceiver.setTrustedRouter(newRouter))
        .to.emit(ccipReceiver, "RouterUpdated")
        .withArgs(trustedRouter.address, newRouter);

      expect(await ccipReceiver.trustedRouter()).to.equal(newRouter);
    });

    it("Should not allow non-owner to update trusted router", async function () {
      await expect(
        ccipReceiver.connect(user1).setTrustedRouter(user2.address)
      ).to.be.revertedWithCustomError(ccipReceiver, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update trusted source chain", async function () {
      const newSourceChain = 999999999;

      await expect(ccipReceiver.setTrustedSourceChain(newSourceChain))
        .to.emit(ccipReceiver, "SourceChainUpdated")
        .withArgs(trustedSourceChain, newSourceChain);

      expect(await ccipReceiver.trustedSourceChain()).to.equal(newSourceChain);
    });

    it("Should allow owner to update escrow game", async function () {
      const newEscrowGame = user1.address;

      await expect(ccipReceiver.setEscrowGame(newEscrowGame))
        .to.emit(ccipReceiver, "EscrowGameUpdated")
        .withArgs(await escrowGame.getAddress(), newEscrowGame);

      expect(await ccipReceiver.escrowGame()).to.equal(newEscrowGame);
    });

    it("Should validate new escrow game address", async function () {
      await expect(
        ccipReceiver.setEscrowGame(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid escrow game address");
    });
  });

  describe("Statistics and Monitoring", function () {
    it("Should track multiple credits correctly", async function () {
      const creditAmount1 = ethers.parseEther("1.0");
      const creditAmount2 = ethers.parseEther("2.0");

      // Add first credit
      await ccipReceiver.simulateCrossChainCredit(user1.address, creditAmount1, trustedSourceChain);

      // Add second credit
      await ccipReceiver.simulateCrossChainCredit(user2.address, creditAmount2, trustedSourceChain);

      // Check total statistics
      const [totalCredits, totalAmount, messageCount] = await ccipReceiver.getStatistics();
      expect(totalCredits).to.equal(2);
      expect(totalAmount).to.equal(creditAmount1 + creditAmount2);
      expect(messageCount).to.equal(2);

      // Check individual user statistics
      const user1Credits = await ccipReceiver.getUserCreditCount(user1.address);
      const user2Credits = await ccipReceiver.getUserCreditCount(user2.address);
      expect(user1Credits).to.equal(1);
      expect(user2Credits).to.equal(1);
    });

    it("Should return empty supported tokens list", async function () {
      const tokens = await ccipReceiver.getSupportedTokens();
      expect(tokens).to.have.length(0);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to recover tokens", async function () {
      const recoveryAmount = ethers.parseEther("1.0");
      const recipient = user1.address;

      // Send some ETH to the contract
      await owner.sendTransaction({
        to: await ccipReceiver.getAddress(),
        value: recoveryAmount
      });

      const initialBalance = await ethers.provider.getBalance(recipient);

      await ccipReceiver.recoverToken(ethers.ZeroAddress, recipient, recoveryAmount);

      const finalBalance = await ethers.provider.getBalance(recipient);
      expect(finalBalance - initialBalance).to.equal(recoveryAmount);
    });

    it("Should allow owner to emergency pause message", async function () {
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("emergency-message"));

      await ccipReceiver.emergencyPauseMessage(messageId);

      const isProcessed = await ccipReceiver.isMessageProcessed(messageId);
      expect(isProcessed).to.be.true;
    });

    it("Should not allow non-owner to use emergency functions", async function () {
      await expect(
        ccipReceiver.connect(user1).recoverToken(ethers.ZeroAddress, user2.address, ethers.parseEther("1.0"))
      ).to.be.revertedWithCustomError(ccipReceiver, "OwnableUnauthorizedAccount");

      await expect(
        ccipReceiver.connect(user1).emergencyPauseMessage(ethers.keccak256(ethers.toUtf8Bytes("test")))
      ).to.be.revertedWithCustomError(ccipReceiver, "OwnableUnauthorizedAccount");
    });
  });
});
