// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./OracleAdapter.sol";

/**
 * @title EscrowGame
 * @dev Oracle-settled UP/DOWN micro-market on Hedera
 * @notice Handles betting rounds, price resolution, and payouts
 */
contract EscrowGame is ReentrancyGuard, Ownable {
    // Events
    event RoundCreated(
        uint256 indexed id,
        bytes32 indexed market,
        uint64 startTs,
        uint64 lockTs,
        uint64 resolveTs,
        int64 refPrice
    );
    
    event BetPlaced(
        uint256 indexed roundId,
        address indexed user,
        uint8 side, // 1 = UP, 2 = DOWN
        uint256 amount
    );
    
    event RoundResolved(
        uint256 indexed roundId,
        uint8 outcome, // 1 = UP, 2 = DOWN, 3 = FLAT
        int64 settlePrice
    );
    
    event Claimed(
        uint256 indexed roundId,
        address indexed user,
        uint256 amount
    );
    
    event FeeTaken(
        uint256 indexed roundId,
        uint256 feeAmount
    );
    
    event CreditAdded(
        address indexed user,
        uint256 amount,
        uint64 sourceChain
    );

    // Structs
    struct Round {
        uint256 id;
        bytes32 market; // e.g., keccak256("HBAR/USD")
        uint64 startTs;
        uint64 lockTs; // last time to place bets
        uint64 resolveTs;
        int64 refPrice; // price at start (scaled, e.g., 1e8)
        int64 settlePrice;
        uint256 upPool;
        uint256 downPool;
        bool resolved;
        uint8 outcome; // 1 = UP, 2 = DOWN, 3 = FLAT
    }

    // Storage
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => uint256)) public upStakes;
    mapping(uint256 => mapping(address => uint256)) public downStakes;
    uint256 public nextRoundId;
    
    address public oracle; // OracleAdapter
    address public feeSink;
    uint16 public feeBps; // platform fee on the winning pool before payouts
    address public ccipReceiver; // optional (internal balance credits)
    mapping(address => uint256) public internalCredits; // optional (CCIP intent)
    
    uint256 public constant MAX_BET = 1000 ether; // Cap to avoid overflow/UX surprises
    uint256 public constant BASIS_POINTS = 10000;

    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call this");
        _;
    }

    modifier validRound(uint256 roundId) {
        require(roundId < nextRoundId, "Round does not exist");
        _;
    }

    modifier roundNotResolved(uint256 roundId) {
        require(!rounds[roundId].resolved, "Round already resolved");
        _;
    }

    constructor(
        address _oracle,
        address _feeSink,
        uint16 _feeBps
    ) Ownable(msg.sender) {
        require(_oracle != address(0), "Invalid oracle address");
        require(_feeSink != address(0), "Invalid fee sink address");
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        
        oracle = _oracle;
        feeSink = _feeSink;
        feeBps = _feeBps;
    }

    /**
     * @dev Create a new betting round
     * @param market Market identifier (e.g., keccak256("HBAR/USD"))
     * @param startTs Start timestamp
     * @param lockTs Lock timestamp (last time to place bets)
     * @param resolveTs Resolve timestamp
     */
    function createRound(
        bytes32 market,
        uint64 startTs,
        uint64 lockTs,
        uint64 resolveTs
    ) external onlyOwner {
        require(lockTs > startTs, "Lock time must be after start");
        require(resolveTs > lockTs, "Resolve time must be after lock");
        require(resolveTs > block.timestamp, "Resolve time must be in future");

        uint256 roundId = nextRoundId++;
        
        // Get reference price from oracle
        (int64 refPrice, , ) = OracleAdapter(oracle).getPrice(market);
        require(refPrice > 0, "Invalid reference price");

        rounds[roundId] = Round({
            id: roundId,
            market: market,
            startTs: startTs,
            lockTs: lockTs,
            resolveTs: resolveTs,
            refPrice: refPrice,
            settlePrice: 0,
            upPool: 0,
            downPool: 0,
            resolved: false,
            outcome: 0
        });

        emit RoundCreated(roundId, market, startTs, lockTs, resolveTs, refPrice);
    }

    /**
     * @dev Place a bet on UP side
     * @param roundId Round ID to bet on
     */
    function betUp(uint256 roundId) 
        external 
        payable 
        nonReentrant 
        validRound(roundId) 
        roundNotResolved(roundId) 
    {
        Round storage round = rounds[roundId];
        require(block.timestamp >= round.startTs, "Round not started");
        require(block.timestamp < round.lockTs, "Betting period ended");
        require(msg.value > 0, "Bet amount must be positive");
        require(msg.value <= MAX_BET, "Bet amount too high");

        upStakes[roundId][msg.sender] += msg.value;
        round.upPool += msg.value;

        emit BetPlaced(roundId, msg.sender, 1, msg.value);
    }

    /**
     * @dev Place a bet on DOWN side
     * @param roundId Round ID to bet on
     */
    function betDown(uint256 roundId) 
        external 
        payable 
        nonReentrant 
        validRound(roundId) 
        roundNotResolved(roundId) 
    {
        Round storage round = rounds[roundId];
        require(block.timestamp >= round.startTs, "Round not started");
        require(block.timestamp < round.lockTs, "Betting period ended");
        require(msg.value > 0, "Bet amount must be positive");
        require(msg.value <= MAX_BET, "Bet amount too high");

        downStakes[roundId][msg.sender] += msg.value;
        round.downPool += msg.value;

        emit BetPlaced(roundId, msg.sender, 2, msg.value);
    }

    /**
     * @dev Resolve a round after resolveTs
     * @param roundId Round ID to resolve
     */
    function resolve(uint256 roundId) 
        external 
        validRound(roundId) 
        roundNotResolved(roundId) 
    {
        Round storage round = rounds[roundId];
        require(block.timestamp >= round.resolveTs, "Resolve time not reached");

        // Get settlement price from oracle
        (int64 settlePrice, , ) = OracleAdapter(oracle).getPrice(round.market);
        require(settlePrice > 0, "Invalid settlement price");

        round.settlePrice = settlePrice;
        round.resolved = true;

        // Determine outcome
        if (settlePrice > round.refPrice) {
            round.outcome = 1; // UP
        } else if (settlePrice < round.refPrice) {
            round.outcome = 2; // DOWN
        } else {
            round.outcome = 3; // FLAT
        }

        emit RoundResolved(roundId, round.outcome, settlePrice);
    }

    /**
     * @dev Claim winnings for a resolved round
     * @param roundId Round ID to claim from
     */
    function claim(uint256 roundId) 
        external 
        nonReentrant 
        validRound(roundId) 
    {
        Round storage round = rounds[roundId];
        require(round.resolved, "Round not resolved");

        uint256 userUpStake = upStakes[roundId][msg.sender];
        uint256 userDownStake = downStakes[roundId][msg.sender];
        uint256 totalUserStake = userUpStake + userDownStake;
        
        require(totalUserStake > 0, "No stake to claim");

        uint256 payout = 0;

        if (round.outcome == 3) {
            // FLAT - refund all stakes
            payout = totalUserStake;
        } else {
            // Calculate winnings
            uint256 userWinningStake = 0;
            uint256 winningPool = 0;

            if (round.outcome == 1) { // UP
                userWinningStake = userUpStake;
                winningPool = round.upPool;
            } else if (round.outcome == 2) { // DOWN
                userWinningStake = userDownStake;
                winningPool = round.downPool;
            }

            if (userWinningStake > 0 && winningPool > 0) {
                // Calculate fee
                uint256 feeAmount = (winningPool * feeBps) / BASIS_POINTS;
                uint256 netWinningPool = winningPool - feeAmount;
                
                // Pro-rata payout
                payout = (userWinningStake * netWinningPool) / winningPool;
                
                // Take fee (only once per round)
                if (feeAmount > 0 && !round.resolved) {
                    payable(feeSink).transfer(feeAmount);
                    emit FeeTaken(roundId, feeAmount);
                }
            }
        }

        // Clear user stakes
        upStakes[roundId][msg.sender] = 0;
        downStakes[roundId][msg.sender] = 0;

        // Transfer payout
        if (payout > 0) {
            payable(msg.sender).transfer(payout);
            emit Claimed(roundId, msg.sender, payout);
        }
    }

    /**
     * @dev Withdraw internal credits (from CCIP)
     * @param amount Amount to withdraw
     */
    function withdrawInternalCredits(uint256 amount) external nonReentrant {
        require(internalCredits[msg.sender] >= amount, "Insufficient credits");
        require(address(this).balance >= amount, "Insufficient contract balance");

        internalCredits[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    /**
     * @dev Add internal credits (called by CCIP receiver)
     * @param user User address
     * @param amount Amount to credit
     * @param sourceChain Source chain ID
     */
    function addInternalCredits(
        address user,
        uint256 amount,
        uint64 sourceChain
    ) external {
        require(msg.sender == ccipReceiver, "Only CCIP receiver");
        
        internalCredits[user] += amount;
        emit CreditAdded(user, amount, sourceChain);
    }

    // Admin functions
    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        oracle = _oracle;
    }

    function setFees(address _feeSink, uint16 _feeBps) external onlyOwner {
        require(_feeSink != address(0), "Invalid fee sink address");
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        feeSink = _feeSink;
        feeBps = _feeBps;
    }

    function setCCIPReceiver(address _ccipReceiver) external onlyOwner {
        ccipReceiver = _ccipReceiver;
    }

    function recoverExcess(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
        
        // TODO: Add logic to ensure we don't touch active round pools
        payable(to).transfer(amount);
    }

    // View functions
    function getRound(uint256 roundId) external view returns (Round memory) {
        require(roundId < nextRoundId, "Round does not exist");
        return rounds[roundId];
    }

    function getUserStakes(uint256 roundId, address user) 
        external 
        view 
        returns (uint256 upStake, uint256 downStake) 
    {
        return (upStakes[roundId][user], downStakes[roundId][user]);
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
