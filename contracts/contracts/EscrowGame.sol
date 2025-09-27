// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { IOracleAdapter } from "./OracleAdapter.sol";

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
        bool feePaid;   // charged once in resolve()
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

    // Oracle staleness tolerance (seconds)
    uint256 public constant MAX_PRICE_AGE = 180; // 3 minutes

    // Fixed-duration round parameters
    uint64 public constant ROUND_SECONDS     = 60; // total round length
    uint64 public constant LOCK_GAP_SECONDS  = 10; // lock occurs this many seconds before resolve

    // Modifiers
    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call this");
        _;
    }

    modifier onlyCCIPReceiver() {
        require(msg.sender == ccipReceiver, "Only CCIP receiver");
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
    ) public onlyOwner {
        require(market != bytes32(0), "Invalid market");
        require(startTs >= uint64(block.timestamp), "Start must be now/future");
        require(lockTs > startTs, "Lock time must be after start");
        require(resolveTs > lockTs, "Resolve time must be after lock");
        require(resolveTs > block.timestamp, "Resolve time must be in future");

        // Tatkal60 invariants: 60s round, lock exactly 10s before resolve
        require(resolveTs == startTs + ROUND_SECONDS, "must be start+60");
        require(lockTs    == resolveTs - LOCK_GAP_SECONDS, "lock must be resolve-10");

        uint256 roundId = nextRoundId++;
        
        // Lazy-lock reference price on first bet after startTs
        rounds[roundId] = Round({
            id: roundId,
            market: market,
            startTs: startTs,
            lockTs: lockTs,
            resolveTs: resolveTs,
            refPrice: 0,
            settlePrice: 0,
            upPool: 0,
            downPool: 0,
            resolved: false,
            feePaid: false,
            outcome: 0
        });

        emit RoundCreated(roundId, market, startTs, lockTs, resolveTs, 0);
    }

    /**
     * @dev Convenience: create a fixed 60s round with a future start time
     * @param market Market identifier
     * @param startTs Start timestamp (must be >= now)
     */
    function createRound60(bytes32 market, uint64 startTs) external onlyOwner {
        require(startTs >= uint64(block.timestamp), "Start must be now/future");
        uint64 resolveTs = startTs + ROUND_SECONDS;
        uint64 lockTs    = resolveTs - LOCK_GAP_SECONDS; // 10s before end => 50s betting
        createRound(market, startTs, lockTs, resolveTs);
    }

    /**
     * @dev Convenience: create a fixed 60s round starting immediately
     * @param market Market identifier
     */
    function createRoundNow60(bytes32 market) external onlyOwner {
        uint64 startTs   = uint64(block.timestamp);
        uint64 resolveTs = startTs + ROUND_SECONDS;
        uint64 lockTs    = resolveTs - LOCK_GAP_SECONDS; // 10s before end => 50s betting
        createRound(market, startTs, lockTs, resolveTs);
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

        // Lazy-lock ref price at first bet after startTs
        if (round.refPrice == 0 && block.timestamp >= round.startTs) {
            (int64 _ref, ) = IOracleAdapter(oracle).getPriceWithFreshness(round.market, MAX_PRICE_AGE);
            require(_ref > 0, "Invalid reference price");
            round.refPrice = _ref;
        }

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

        // Lazy-lock ref price at first bet after startTs
        if (round.refPrice == 0 && block.timestamp >= round.startTs) {
            (int64 _ref, ) = IOracleAdapter(oracle).getPriceWithFreshness(round.market, MAX_PRICE_AGE);
            require(_ref > 0, "Invalid reference price");
            round.refPrice = _ref;
        }

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

        // If no reference price was ever captured, it means no bet happened after start.
        // Allow round to resolve as FLAT without touching the oracle so old empty rounds don't get stuck.
        if (round.refPrice == 0) {
            round.outcome = 3; // FLAT
            round.settlePrice = 0;
            round.resolved = true;
            emit RoundResolved(roundId, 3, 0);
            return;
        }

        // Get settlement price from oracle
        (int64 settlePrice, ) = IOracleAdapter(oracle).getPriceWithFreshness(round.market, MAX_PRICE_AGE);
        require(settlePrice > 0, "Invalid settlement price");

        round.settlePrice = settlePrice;

        // Determine outcome
        if (settlePrice > round.refPrice) {
            round.outcome = 1; // UP
        } else if (settlePrice < round.refPrice) {
            round.outcome = 2; // DOWN
        } else {
            round.outcome = 3; // FLAT
        }

        // If no one bet on the winning side, void the round
        if ((round.outcome == 1 && round.upPool == 0) || (round.outcome == 2 && round.downPool == 0)) {
            round.outcome = 3; // FLAT
        }

        // Charge fee once (non-FLAT only)
        if (round.outcome == 1 || round.outcome == 2) {
            uint256 totalPool = round.upPool + round.downPool;
            uint256 feeAmount = (totalPool * feeBps) / BASIS_POINTS;
            if (feeAmount > 0) {
                (bool ok, ) = payable(feeSink).call{value: feeAmount}("");
                require(ok, "Fee transfer failed");
                round.feePaid = true;
                emit FeeTaken(roundId, feeAmount);
            }
        }

        round.resolved = true;
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
            uint256 totalWinningStake = (round.outcome == 1) ? round.upPool : round.downPool;
            uint256 totalLosingStake  = (round.outcome == 1) ? round.downPool : round.upPool;
            require(totalWinningStake > 0, "No winners");

            uint256 totalPool     = totalWinningStake + totalLosingStake;
            uint256 feeAmount     = (totalPool * feeBps) / BASIS_POINTS;
            uint256 distributable = totalPool - feeAmount;

            uint256 userWinningStake = (round.outcome == 1) ? userUpStake : userDownStake;
            payout = (userWinningStake * distributable) / totalWinningStake;
        }

        // Clear user stakes first (CEI)
        upStakes[roundId][msg.sender] = 0;
        downStakes[roundId][msg.sender] = 0;

        // Transfer payout safely
        if (payout > 0) {
            (bool ok, ) = payable(msg.sender).call{value: payout}("");
            require(ok, "HBAR transfer failed");
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
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "HBAR transfer failed");
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
    ) external onlyCCIPReceiver {
        
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
        if (nextRoundId > 0) {
            require(rounds[nextRoundId - 1].resolved, "Open rounds exist");
        }
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "recover failed");
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

    /**
     * @dev On-chain status helper for front-end (1=Upcoming, 2=Betting, 3=Locked, 4=Resolving, 5=Resolved)
     */
    function roundStatus(uint256 roundId) external view validRound(roundId) returns (uint8) {
        Round storage r = rounds[roundId];
        if (r.resolved) return 5; // Resolved
        if (block.timestamp < r.startTs) return 1; // Upcoming
        if (block.timestamp < r.lockTs) return 2; // Betting
        if (block.timestamp < r.resolveTs) return 3; // Locked
        return 4; // Resolving
    }

    receive() external payable {}
}
