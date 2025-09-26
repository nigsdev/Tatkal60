import { expect } from "chai";
import { ethers } from "hardhat";

describe("OracleAdapter", function () {
  let oracleAdapter;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await oracleAdapter.getAddress()).to.be.properAddress;
    });
  });

  describe("Price Feeds", function () {
    it("Should return HBAR/USD price", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      
      const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(market);
      
      expect(price).to.be.gt(0);
      expect(decimals).to.equal(8);
      expect(lastUpdate).to.be.gt(0);
    });

    it("Should return ETH/USD price", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));
      
      const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(market);
      
      expect(price).to.be.gt(0);
      expect(decimals).to.equal(8);
      expect(lastUpdate).to.be.gt(0);
    });

    it("Should return BTC/USD price", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("BTC/USD"));
      
      const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(market);
      
      expect(price).to.be.gt(0);
      expect(decimals).to.equal(8);
      expect(lastUpdate).to.be.gt(0);
    });

    it("Should return zero for unknown market", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("UNKNOWN/USD"));
      
      const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(market);
      
      expect(price).to.equal(0);
      expect(decimals).to.equal(0);
      expect(lastUpdate).to.equal(0);
    });

    it("Should return consistent prices for same market", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      
      const [price1, decimals1, lastUpdate1] = await oracleAdapter.getPrice(market);
      const [price2, decimals2, lastUpdate2] = await oracleAdapter.getPrice(market);
      
      expect(price1).to.equal(price2);
      expect(decimals1).to.equal(decimals2);
      expect(lastUpdate1).to.equal(lastUpdate2);
    });

    it("Should return different prices for different markets", async function () {
      const hbarMarket = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const ethMarket = ethers.keccak256(ethers.toUtf8Bytes("ETH/USD"));
      
      const [hbarPrice] = await oracleAdapter.getPrice(hbarMarket);
      const [ethPrice] = await oracleAdapter.getPrice(ethMarket);
      
      expect(hbarPrice).to.not.equal(ethPrice);
    });
  });

  describe("Price Format", function () {
    it("Should return prices with correct decimal places", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      
      const [price, decimals] = await oracleAdapter.getPrice(market);
      
      // Price should be in the expected range for HBAR (around $0.07)
      // With 8 decimals, this would be around 7000000
      expect(price).to.be.gt(1000000); // > $0.01
      expect(price).to.be.lt(100000000); // < $1.00
      expect(decimals).to.equal(8);
    });

    it("Should return valid timestamps", async function () {
      const market = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      
      const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(market);
      
      const currentTime = Math.floor(Date.now() / 1000);
      expect(lastUpdate).to.be.gte(currentTime - 10); // Within last 10 seconds
      expect(lastUpdate).to.be.lte(currentTime + 10); // Not in the future
    });
  });

  describe("Market Identifiers", function () {
    it("Should handle different market formats", async function () {
      const markets = [
        "HBAR/USD",
        "ETH/USD", 
        "BTC/USD",
        "HBAR-USD",
        "ETH-USD",
        "BTC-USD"
      ];

      for (const marketStr of markets) {
        const market = ethers.keccak256(ethers.toUtf8Bytes(marketStr));
        const [price, decimals, lastUpdate] = await oracleAdapter.getPrice(market);
        
        // At least one of these should return a valid price
        if (marketStr.includes("HBAR") || marketStr.includes("ETH") || marketStr.includes("BTC")) {
          expect(price).to.be.gt(0);
          expect(decimals).to.equal(8);
        }
      }
    });

    it("Should be case sensitive", async function () {
      const upperMarket = ethers.keccak256(ethers.toUtf8Bytes("HBAR/USD"));
      const lowerMarket = ethers.keccak256(ethers.toUtf8Bytes("hbar/usd"));
      
      const [upperPrice] = await oracleAdapter.getPrice(upperMarket);
      const [lowerPrice] = await oracleAdapter.getPrice(lowerMarket);
      
      expect(upperPrice).to.not.equal(lowerPrice);
    });
  });
});
