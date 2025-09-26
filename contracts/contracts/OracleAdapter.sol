// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OracleAdapter
 * @dev Adapter contract for price feeds (Pyth, Chainlink, or mock)
 * @notice Provides standardized price data interface
 */
contract OracleAdapter {
    // Events
    event PriceUpdated(bytes32 indexed market, int64 price, uint8 decimals, uint256 timestamp);

    // Storage
    mapping(bytes32 => PriceData) public prices;
    address public owner;
    
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
        PriceData memory data = prices[market];
        require(data.isValid, "Price not available");
        
        return (data.price, data.decimals, data.lastUpdate);
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
        
        // Convert to string (simplified for MVP)
        if (data.decimals == 8) {
            uint256 priceInt = uint256(int256(data.price));
            uint256 wholePart = priceInt / 1e8;
            uint256 decimalPart = priceInt % 1e8;
            
            priceFormatted = string(abi.encodePacked(
                _uint2str(wholePart),
                ".",
                _uint2str(decimalPart)
            ));
        } else {
            priceFormatted = _uint2str(uint256(int256(data.price)));
        }
        
        return (priceFormatted, data.decimals);
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
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}
