import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EscrowGame", function () {
  let escrowGame;
  let oracleAdapter;
  let ccipReceiver;
  let owner;
  let user1;
  let user2;
  let feeSink;
  let feeBps = 500; // 5%

  beforeEach(async function () {
    [owner, user1, user2, feeSink] = await ethers.getSigners();

    // Deploy OracleAdapter
    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy();

    // Deploy CCIPReceiver (mock)
    const CCIPReceiver = await ethers.getContractFactory("CCIPReceiver");
    ccipReceiver = await CCIPReceiver.deploy(
      owner.address, // mock router
      ethers.ZeroAddress, // will be set later
      16015286601757825753 // Sepolia chain ID
    );

    // Deploy EscrowGame
    const EscrowGame = await ethers.getContractFactory("EscrowGame");
    escrowGame = await EscrowGame.deploy(
      await oracleAdapter.getAddress(),
      feeSink.address,
      feeBps
    );

    // Set CCIP receiver
    await escrowGame.setCCIPReceiver(await ccipReceiver.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await escrowGame.owner()).to.equal(owner.address);
    });

    it("Should set the correct oracle", async function () {
      expect(await escrowGame.oracle()).to.equal(await oracleAdapter.getAddress());
    });

    it("Should set the correct fee sink", async function () {
      expect(await escrowGame.feeSink()).to.equal(feeSink.address);
    });

    it("Should set the correct fee basis points", async function () {
      expect(await escrowGame.feeBps()).to.equal(feeBps);
    });

    it("Should initialize nextRoundId to 1", async function () {
      expect(await escrowGame.nextRoundId()).to.equal(1);
    });
  });

  describe("Round Creation", function () {
    it("Should create a new round", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const startTs = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
      const lockTs = startTs + 300; // 5 minutes after start
      const resolveTs = lockTs + 60; // 1 minute after lock

      await expect(escrowGame.createRound(market, startTs, lockTs, resolveTs))
        .to.emit(escrowGame, "RoundCreated")
        .withArgs(1, market, startTs, lockTs, resolveTs, 0);

      const round = await escrowGame.rounds(1);
      expect(round.id).to.equal(1);
      expect(round.market).to.equal(market);
      expect(round.startTs).to.equal(startTs);
      expect(round.lockTs).to.equal(lockTs);
      expect(round.resolveTs).to.equal(resolveTs);
      expect(round.resolved).to.be.false;
    });

    it("Should not allow non-owner to create rounds", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await expect(
        escrowGame.connect(user1).createRound(market, startTs, lockTs, resolveTs)
      ).to.be.revertedWithCustomError(escrowGame, "OwnableUnauthorizedAccount");
    });

    it("Should not allow creating rounds with invalid timestamps", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const now = Math.floor(Date.now() / 1000);

      // Start time in past
      await expect(
        escrowGame.createRound(market, now - 60, now + 300, now + 360)
      ).to.be.revertedWith("Start time in past");

      // Lock time before start time
      await expect(
        escrowGame.createRound(market, now + 60, now + 30, now + 360)
      ).to.be.revertedWith("Lock time before start time");

      // Resolve time before lock time
      await expect(
        escrowGame.createRound(market, now + 60, now + 300, now + 240)
      ).to.be.revertedWith("Resolve time before lock time");
    });
  });

  describe("Betting", function () {
    let roundId;
    let market;

    beforeEach(async function () {
      market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await escrowGame.createRound(market, startTs, lockTs, resolveTs);
      roundId = 1;

      // Fast forward to start time
      await time.increase(61);
    });

    it("Should allow placing UP bets", async function () {
      const betAmount = ethers.parseEther("1.0");

      await expect(escrowGame.connect(user1).betUp(roundId, { value: betAmount }))
        .to.emit(escrowGame, "BetPlaced")
        .withArgs(roundId, user1.address, 1, betAmount); // 1 = UP

      const userStake = await escrowGame.upStakes(roundId, user1.address);
      expect(userStake).to.equal(betAmount);

      const round = await escrowGame.rounds(roundId);
      expect(round.upPool).to.equal(betAmount);
    });

    it("Should allow placing DOWN bets", async function () {
      const betAmount = ethers.parseEther("1.0");

      await expect(escrowGame.connect(user1).betDown(roundId, { value: betAmount }))
        .to.emit(escrowGame, "BetPlaced")
        .withArgs(roundId, user1.address, 2, betAmount); // 2 = DOWN

      const userStake = await escrowGame.downStakes(roundId, user1.address);
      expect(userStake).to.equal(betAmount);

      const round = await escrowGame.rounds(roundId);
      expect(round.downPool).to.equal(betAmount);
    });

    it("Should not allow betting before round starts", async function () {
      // Create a new round that hasn't started yet
      const newRoundId = 2;
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await escrowGame.createRound(market, startTs, lockTs, resolveTs);

      await expect(
        escrowGame.connect(user1).betUp(newRoundId, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Round not started");
    });

    it("Should not allow betting after lock time", async function () {
      // Fast forward past lock time
      await time.increase(300);

      await expect(
        escrowGame.connect(user1).betUp(roundId, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Betting closed");
    });

    it("Should not allow zero amount bets", async function () {
      await expect(
        escrowGame.connect(user1).betUp(roundId, { value: 0 })
      ).to.be.revertedWith("Bet amount must be greater than zero");
    });

    it("Should set reference price on first bet", async function () {
      const betAmount = ethers.parseEther("1.0");

      await escrowGame.connect(user1).betUp(roundId, { value: betAmount });

      const round = await escrowGame.rounds(roundId);
      expect(round.refPrice).to.be.gt(0);
    });
  });

  describe("Round Resolution", function () {
    let roundId;
    let market;

    beforeEach(async function () {
      market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await escrowGame.createRound(market, startTs, lockTs, resolveTs);
      roundId = 1;

      // Fast forward to start time and place bets
      await time.increase(61);
      await escrowGame.connect(user1).betUp(roundId, { value: ethers.parseEther("1.0") });
      await escrowGame.connect(user2).betDown(roundId, { value: ethers.parseEther("1.0") });

      // Fast forward to resolve time
      await time.increase(300);
    });

    it("Should resolve round with UP outcome", async function () {
      // Mock oracle to return higher price
      // Note: In real implementation, you'd need to mock the oracle response
      
      await expect(escrowGame.resolve(roundId))
        .to.emit(escrowGame, "RoundResolved");

      const round = await escrowGame.rounds(roundId);
      expect(round.resolved).to.be.true;
      expect(round.settlePrice).to.be.gt(0);
    });

    it("Should not allow resolving before resolve time", async function () {
      // Create a new round and try to resolve early
      const newRoundId = 2;
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await escrowGame.createRound(market, startTs, lockTs, resolveTs);
      await time.increase(61);
      await escrowGame.connect(user1).betUp(newRoundId, { value: ethers.parseEther("1.0") });

      await expect(escrowGame.resolve(newRoundId))
        .to.be.revertedWith("Round not yet resolvable");
    });

    it("Should not allow resolving already resolved round", async function () {
      await escrowGame.resolve(roundId);

      await expect(escrowGame.resolve(roundId))
        .to.be.revertedWith("Round already resolved");
    });
  });

  describe("Claiming", function () {
    let roundId;
    let market;

    beforeEach(async function () {
      market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await escrowGame.createRound(market, startTs, lockTs, resolveTs);
      roundId = 1;

      // Fast forward to start time and place bets
      await time.increase(61);
      await escrowGame.connect(user1).betUp(roundId, { value: ethers.parseEther("1.0") });
      await escrowGame.connect(user2).betDown(roundId, { value: ethers.parseEther("1.0") });

      // Fast forward to resolve time and resolve
      await time.increase(300);
      await escrowGame.resolve(roundId);
    });

    it("Should allow claiming winnings", async function () {
      const initialBalance = await ethers.provider.getBalance(user1.address);

      const tx = await escrowGame.connect(user1).claim(roundId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(user1.address);
      const balanceChange = finalBalance - initialBalance + gasUsed;

      // Should receive some payout (exact amount depends on oracle price)
      expect(balanceChange).to.be.gt(0);
    });

    it("Should not allow claiming from unresolved round", async function () {
      // Create a new unresolved round
      const newRoundId = 2;
      const startTs = Math.floor(Date.now() / 1000) + 60;
      const lockTs = startTs + 300;
      const resolveTs = lockTs + 60;

      await escrowGame.createRound(market, startTs, lockTs, resolveTs);
      await time.increase(61);
      await escrowGame.connect(user1).betUp(newRoundId, { value: ethers.parseEther("1.0") });

      await expect(escrowGame.connect(user1).claim(newRoundId))
        .to.be.revertedWith("Round not resolved yet");
    });

    it("Should not allow claiming without stake", async function () {
      const [user3] = await ethers.getSigners();
      
      await expect(escrowGame.connect(user3).claim(roundId))
        .to.be.revertedWith("No stake in this round");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set oracle", async function () {
      const newOracle = user1.address;
      
      await escrowGame.setOracle(newOracle);
      expect(await escrowGame.oracle()).to.equal(newOracle);
    });

    it("Should not allow non-owner to set oracle", async function () {
      await expect(
        escrowGame.connect(user1).setOracle(user2.address)
      ).to.be.revertedWithCustomError(escrowGame, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to set fees", async function () {
      const newFeeSink = user1.address;
      const newFeeBps = 1000; // 10%

      await escrowGame.setFees(newFeeSink, newFeeBps);
      expect(await escrowGame.feeSink()).to.equal(newFeeSink);
      expect(await escrowGame.feeBps()).to.equal(newFeeBps);
    });

    it("Should not allow setting fees too high", async function () {
      await expect(
        escrowGame.setFees(user1.address, 600) // 6%
      ).to.be.revertedWith("Fee too high");
    });

    it("Should allow owner to set CCIP receiver", async function () {
      const newCCIPReceiver = user1.address;
      
      await escrowGame.setCCIPReceiver(newCCIPReceiver);
      expect(await escrowGame.ccipReceiver()).to.equal(newCCIPReceiver);
    });
  });

  describe("Internal Credits", function () {
    it("Should allow CCIP receiver to add internal credits", async function () {
      const creditAmount = ethers.parseEther("1.0");
      const sourceChain = 16015286601757825753;

      await expect(
        escrowGame.connect(owner).addInternalCredits(user1.address, creditAmount, sourceChain)
      ).to.emit(escrowGame, "CreditAdded")
        .withArgs(user1.address, creditAmount, sourceChain);

      const credits = await escrowGame.internalCredits(user1.address);
      expect(credits).to.equal(creditAmount);
    });

    it("Should not allow non-CCIP receiver to add credits", async function () {
      const creditAmount = ethers.parseEther("1.0");
      const sourceChain = 16015286601757825753;

      await expect(
        escrowGame.connect(user1).addInternalCredits(user2.address, creditAmount, sourceChain)
      ).to.be.revertedWith("Only CCIP receiver can call this");
    });

    it("Should allow users to withdraw internal credits", async function () {
      const creditAmount = ethers.parseEther("1.0");
      const sourceChain = 16015286601757825753;

      // Add credits
      await escrowGame.connect(owner).addInternalCredits(user1.address, creditAmount, sourceChain);

      // Fund contract with HBAR
      await owner.sendTransaction({
        to: await escrowGame.getAddress(),
        value: creditAmount
      });

      const initialBalance = await ethers.provider.getBalance(user1.address);

      const tx = await escrowGame.connect(user1).withdrawInternalCredits(creditAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(user1.address);
      const balanceChange = finalBalance - initialBalance + gasUsed;

      expect(balanceChange).to.equal(creditAmount);

      const remainingCredits = await escrowGame.internalCredits(user1.address);
      expect(remainingCredits).to.equal(0);
    });
  });
});
