// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// NOTE: Set the Pyth contract address via setPyth(_pyth) for your target network (Hedera testnet/mainnet).
// Hedera Pyth address can be found in Pyth docs under EVM contract addresses.

/**
 * @title OracleAdapter
 * @dev Adapter contract for price feeds (Pyth)
 * @notice Provides standardized price data interface
 */

/**
 * @title IOracleAdapter
 * @dev Minimal interface so other contracts can depend on an abstraction.
 */
interface IOracleAdapter {
    function getPrice(bytes32 market)
        external
        view
        returns (int64 price, uint8 decimals, uint256 lastUpdate);

    function getPriceWithFreshness(bytes32 market, uint256 maxAge)
        external
        view
        returns (int64 price, uint8 decimals);
}

/**
 * @dev Minimal IPyth interface & structs (inline to avoid external deps)
 */
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory price);
    function getPrice(bytes32 id) external view returns (Price memory price);
}

contract OracleAdapter {
    // Events
    event PriceUpdated(bytes32 indexed market, int64 price, uint8 decimals, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Storage
    mapping(bytes32 => PriceData) public prices;
    address public owner;

    // Pyth config
    address public pyth;                      // Pyth contract address on Hedera
    mapping(bytes32 => bytes32) public priceIdByMarket; // market => Pyth price feed id
    uint8 public constant TARGET_DECIMALS = 8;
    uint256 public constant DEFAULT_MAX_AGE = 1 days;
    
    // Market constants
    bytes32 public constant HBAR_USD = keccak256("HBAR/USD");
    bytes32 public constant ETH_USD = keccak256("ETH/USD");
    bytes32 public constant BTC_USD = keccak256("BTC/USD");

    struct PriceData {
        int64 price;
        uint8 decimals;
        uint256 lastUpdate;
        bool isValid;
    }

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        
        // Initialize with mock prices for MVP
        _setPrice(HBAR_USD, 0.05e8, 8); // $0.05 with 8 decimals
        _setPrice(ETH_USD, 2000e8, 8);  // $2000 with 8 decimals
        _setPrice(BTC_USD, 45000e8, 8); // $45000 with 8 decimals

        // Default wiring for BTC/USD (Pyth). Replace if needed via setMarketPriceId().
        // Common BTC/USD Pyth price feed id:
        // 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
        priceIdByMarket[BTC_USD] = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    }

    /**
     * @dev Set Pyth contract address
     */
    function setPyth(address _pyth) external onlyOwner {
        require(_pyth != address(0), "Invalid Pyth address");
        pyth = _pyth;
    }

    /**
     * @dev Map a market to a Pyth price feed id
     */
    function setMarketPriceId(bytes32 market, bytes32 priceId) external onlyOwner {
        require(market != bytes32(0) && priceId != bytes32(0), "Invalid params");
        priceIdByMarket[market] = priceId;
    }

    /**
     * @dev Get price for a market
     * @param market Market identifier
     * @return price Price with decimals
     * @return decimals Number of decimals
     * @return lastUpdate Last update timestamp
     */
    function getPrice(bytes32 market)
        external
        view
        returns (int64 price, uint8 decimals, uint256 lastUpdate)
    {
        // Prefer Pyth if configured for this market
        if (pyth != address(0)) {
            bytes32 id = priceIdByMarket[market];
            if (id != bytes32(0)) {
                IPyth.Price memory p = IPyth(pyth).getPriceNoOlderThan(id, DEFAULT_MAX_AGE);
                int64 scaled = _scaleToTarget(p.price, p.expo, TARGET_DECIMALS);
                return (scaled, TARGET_DECIMALS, p.publishTime);
            }
        }
        // Fallback to mock/local storage
        PriceData memory data = prices[market];
        require(data.isValid, "Price not available");
        return (data.price, data.decimals, data.lastUpdate);
    }

    /**
     * @dev Get price and decimals only if the value is fresh enough
     * @param market Market identifier
     * @param maxAge Maximum allowed staleness in seconds
     */
    function getPriceWithFreshness(bytes32 market, uint256 maxAge)
        external
        view
        returns (int64 price, uint8 decimals)
    {
        if (pyth != address(0)) {
            bytes32 id = priceIdByMarket[market];
            if (id != bytes32(0)) {
                IPyth.Price memory p = IPyth(pyth).getPriceNoOlderThan(id, maxAge);
                int64 scaled = _scaleToTarget(p.price, p.expo, TARGET_DECIMALS);
                return (scaled, TARGET_DECIMALS);
            }
        }
        PriceData memory data = prices[market];
        require(data.isValid, "Price not available");
        require(block.timestamp - data.lastUpdate <= maxAge, "Stale price");
        return (data.price, data.decimals);
    }

    /**
     * @dev Update price (for mock/testing)
     * @param market Market identifier
     * @param price New price
     * @param decimals Number of decimals
     */
    function updatePrice(
        bytes32 market,
        int64 price,
        uint8 decimals
    ) external onlyOwner {
        _setPrice(market, price, decimals);
    }

    /**
     * @dev Batch update multiple markets in one tx (owner-only). Arrays must be same length.
     */
    function updatePricesBatch(
        bytes32[] calldata markets,
        int64[] calldata priceList,
        uint8[] calldata decimalsList
    ) external onlyOwner {
        uint256 len = markets.length;
        require(priceList.length == len && decimalsList.length == len, "Array length mismatch");
        for (uint256 i = 0; i < len; i++) {
            _setPrice(markets[i], priceList[i], decimalsList[i]);
        }
    }

    /**
     * @dev Set price internally
     * @param market Market identifier
     * @param price Price value
     * @param decimals Number of decimals
     */
    function _setPrice(
        bytes32 market,
        int64 price,
        uint8 decimals
    ) internal {
        require(price > 0, "Price must be positive");
        require(decimals <= 18, "Too many decimals");

        prices[market] = PriceData({
            price: price,
            decimals: decimals,
            lastUpdate: block.timestamp,
            isValid: true
        });

        emit PriceUpdated(market, price, decimals, block.timestamp);
    }

    /**
     * @dev Get available markets
     * @return markets Array of market identifiers
     */
    function getAvailableMarkets() external pure returns (bytes32[] memory markets) {
        markets = new bytes32[](3);
        markets[0] = HBAR_USD;
        markets[1] = ETH_USD;
        markets[2] = BTC_USD;
    }

    /**
     * @dev Check if market is supported
     * @param market Market identifier
     * @return supported True if market is supported
     */
    function isMarketSupported(bytes32 market) external view returns (bool supported) {
        return prices[market].isValid;
    }

    /**
     * @dev Get price with human-readable format
     * @param market Market identifier
     * @return priceFormatted Price as string
     * @return decimals Number of decimals
     */
    function getPriceFormatted(bytes32 market)
        external
        view
        returns (string memory priceFormatted, uint8 decimals)
    {
        PriceData memory data = prices[market];
        require(data.isValid, "Price not available");

        uint8 decs = data.decimals;
        uint256 scale = decs == 0 ? 1 : 10 ** uint256(decs);
        uint256 priceInt = uint256(int256(data.price));

        if (decs == 0) {
            priceFormatted = _uint2str(priceInt);
        } else {
            uint256 wholePart = priceInt / scale;
            uint256 decimalPart = priceInt % scale;
            priceFormatted = string(
                abi.encodePacked(
                    _uint2str(wholePart),
                    ".",
                    _leftPadZeros(_uint2str(decimalPart), decs)
                )
            );
        }

        return (priceFormatted, decs);
    }

    /**
     * @dev Convert uint to string (helper function)
     * @param _i Number to convert
     * @return String representation
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        
        return string(bstr);
    }

    /**
     * @dev Left-pad a numeric string with zeros up to a fixed width
     * @param s Numeric string without sign
     * @param width Desired total length (e.g., decimals)
     */
    function _leftPadZeros(string memory s, uint8 width) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length >= width) return s;

        bytes memory out = new bytes(width);
        uint256 pad = width - b.length;
        for (uint256 i = 0; i < pad; i++) {
            out[i] = "0";
        }
        for (uint256 j = 0; j < b.length; j++) {
            out[pad + j] = b[j];
        }
        return string(out);
    }

    /**
     * @dev Scale Pyth price/exponent to target decimals (e.g., 8)
     */
    function _scaleToTarget(int64 rawPrice, int32 expo, uint8 targetDecimals) internal pure returns (int64) {
        // scaled = rawPrice * 10^(expo + targetDecimals)
        int256 p = int256(rawPrice);
        int256 e = int256(int256(expo) + int256(uint256(targetDecimals)));
        if (e > 0) {
            uint256 mul = 10 ** uint256(e);
            int256 r = p * int256(mul);
            require(r <= type(int64).max && r >= type(int64).min, "Overflow");
            return int64(r);
        } else if (e < 0) {
            uint256 div = 10 ** uint256(-e);
            return int64(p / int256(div));
        } else {
            return rawPrice;
        }
    }

    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
