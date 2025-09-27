import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Tatkal60 Round Creation", function () {
  let escrowGame;
  let oracleAdapter;
  let owner;
  let user1;
  let user2;

  const BTC_MARKET = ethers.keccak256(ethers.toUtf8Bytes("BTC/USD"));
  const ROUND_SECONDS = 60;
  const LOCK_GAP_SECONDS = 10;
  const EXPECTED_BETTING_WINDOW = 50; // 60 - 10

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy OracleAdapter
    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy();
    await oracleAdapter.waitForDeployment();

    // Deploy EscrowGame
    const EscrowGame = await ethers.getContractFactory("EscrowGame");
    escrowGame = await EscrowGame.deploy(
      await oracleAdapter.getAddress(),
      owner.address,
      500 // 5% fee
    );
    await escrowGame.waitForDeployment();
  });

  describe("Contract Constants", function () {
    it("should have correct ROUND_SECONDS", async function () {
      const roundSeconds = await escrowGame.ROUND_SECONDS();
      expect(Number(roundSeconds)).to.equal(ROUND_SECONDS);
    });

    it("should have correct LOCK_GAP_SECONDS", async function () {
      const lockGapSeconds = await escrowGame.LOCK_GAP_SECONDS();
      expect(Number(lockGapSeconds)).to.equal(LOCK_GAP_SECONDS);
    });
  });

  describe("Round Creation", function () {
    it("should create round with correct timing using createRound", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const resolveTime = startTime + ROUND_SECONDS;
      const lockTime = resolveTime - LOCK_GAP_SECONDS;

      await escrowGame.createRound(
        BTC_MARKET,
        startTime,
        lockTime,
        resolveTime
      );

      const round = await escrowGame.getRound(0);
      expect(Number(round.startTs)).to.equal(startTime);
      expect(Number(round.lockTs)).to.equal(lockTime);
      expect(Number(round.resolveTs)).to.equal(resolveTime);

      // Verify betting window is 50 seconds
      const bettingWindow = Number(round.lockTs) - Number(round.startTs);
      expect(bettingWindow).to.equal(EXPECTED_BETTING_WINDOW);
    });

    it("should create round with correct timing using createRound60", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 100;

      await escrowGame.createRound60(BTC_MARKET, startTime);

      const round = await escrowGame.getRound(0);
      expect(Number(round.startTs)).to.equal(startTime);
      expect(Number(round.resolveTs)).to.equal(startTime + ROUND_SECONDS);
      expect(Number(round.lockTs)).to.equal(startTime + ROUND_SECONDS - LOCK_GAP_SECONDS);

      // Verify betting window is 50 seconds
      const bettingWindow = Number(round.lockTs) - Number(round.startTs);
      expect(bettingWindow).to.equal(EXPECTED_BETTING_WINDOW);
    });

    it("should create round with correct timing using createRoundNow60", async function () {
      const tx = await escrowGame.createRoundNow60(BTC_MARKET);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const blockTime = block.timestamp;

      const round = await escrowGame.getRound(0);
      expect(Number(round.startTs)).to.equal(blockTime);
      expect(Number(round.resolveTs)).to.equal(blockTime + ROUND_SECONDS);
      expect(Number(round.lockTs)).to.equal(blockTime + ROUND_SECONDS - LOCK_GAP_SECONDS);

      // Verify betting window is 50 seconds
      const bettingWindow = Number(round.lockTs) - Number(round.startTs);
      expect(bettingWindow).to.equal(EXPECTED_BETTING_WINDOW);
    });

    it("should enforce Tatkal60 invariants", async function () {
      const startTime = Math.floor(Date.now() / 1000) + 100;
      const resolveTime = startTime + ROUND_SECONDS;
      const lockTime = resolveTime - LOCK_GAP_SECONDS;

      // This should succeed
      await escrowGame.createRound(BTC_MARKET, startTime, lockTime, resolveTime);

      // Test invalid resolve time (not start + 60)
      await expect(
        escrowGame.createRound(BTC_MARKET, startTime, lockTime, startTime + 30)
      ).to.be.revertedWith("must be start+60");

      // Test invalid lock time (not resolve - 10)
      await expect(
        escrowGame.createRound(BTC_MARKET, startTime, startTime + 20, resolveTime)
      ).to.be.revertedWith("lock must be resolve-10");
    });
  });

  describe("Round Status and Betting", function () {
    let roundId;
    let startTime;
    let lockTime;
    let resolveTime;

    beforeEach(async function () {
      startTime = Math.floor(Date.now() / 1000) + 100;
      resolveTime = startTime + ROUND_SECONDS;
      lockTime = resolveTime - LOCK_GAP_SECONDS;

      await escrowGame.createRound(BTC_MARKET, startTime, lockTime, resolveTime);
      roundId = 0;
    });

    it("should have correct round status at different times", async function () {
      // Before start - should be Upcoming (1)
      let status = await escrowGame.roundStatus(roundId);
      expect(Number(status)).to.equal(1); // Upcoming

      // During betting period - should be Betting (2)
      await time.increaseTo(startTime + 10);
      
      status = await escrowGame.roundStatus(roundId);
      expect(Number(status)).to.equal(2); // Betting

      // During lock period - should be Locked (3)
      await time.increaseTo(lockTime + 5);
      
      status = await escrowGame.roundStatus(roundId);
      expect(Number(status)).to.equal(3); // Locked

      // During resolve period - should be Resolving (4)
      await time.increaseTo(resolveTime + 5);
      
      status = await escrowGame.roundStatus(roundId);
      expect(Number(status)).to.equal(4); // Resolving
    });

    it("should allow betting only during betting period", async function () {
      const betAmount = ethers.parseEther("0.1");

      // Before start - should fail
      await expect(
        escrowGame.connect(user1).betUp(roundId, { value: betAmount })
      ).to.be.revertedWith("Round not started");

      // During betting period - should succeed
      await time.increaseTo(startTime + 10);
      
      await expect(
        escrowGame.connect(user1).betUp(roundId, { value: betAmount })
      ).to.not.be.reverted;

      // After lock time - should fail
      await time.increaseTo(lockTime + 5);
      
      await expect(
        escrowGame.connect(user2).betUp(roundId, { value: betAmount })
      ).to.be.revertedWith("Betting period ended");
    });

    it("should have 50-second betting window", async function () {
      const betAmount = ethers.parseEther("0.1");

      // Move to start time
      await time.increaseTo(startTime);

      // Should be able to bet at start
      await expect(
        escrowGame.connect(user1).betUp(roundId, { value: betAmount })
      ).to.not.be.reverted;

      // Move to 49 seconds after start (still in betting period)
      await time.increaseTo(startTime + 49);

      await expect(
        escrowGame.connect(user2).betDown(roundId, { value: betAmount })
      ).to.not.be.reverted;

      // Move to 50 seconds after start (lock time)
      await time.increaseTo(startTime + 50);

      // Should not be able to bet anymore
      await expect(
        escrowGame.connect(user1).betUp(roundId, { value: betAmount })
      ).to.be.revertedWith("Betting period ended");
    });
  });

  describe("Round Resolution", function () {
    let roundId;
    let startTime;
    let lockTime;
    let resolveTime;

    beforeEach(async function () {
      startTime = Math.floor(Date.now() / 1000) + 100;
      resolveTime = startTime + ROUND_SECONDS;
      lockTime = resolveTime - LOCK_GAP_SECONDS;

      await escrowGame.createRound(BTC_MARKET, startTime, lockTime, resolveTime);
      roundId = 0;
    });

    it("should resolve round after resolve time", async function () {
      // Move to resolve time
      await time.increaseTo(resolveTime);

      // Should be able to resolve
      await expect(escrowGame.resolve(roundId)).to.not.be.reverted;

      const round = await escrowGame.getRound(roundId);
      expect(round.resolved).to.be.true;
    });

    it("should not resolve before resolve time", async function () {
      // Move to before resolve time
      await time.increaseTo(resolveTime - 1);

      // Should not be able to resolve
      await expect(escrowGame.resolve(roundId)).to.be.revertedWith("Resolve time not reached");
    });
  });
});
