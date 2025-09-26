// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CCIPReceiver
 * @dev Simplified CCIP receiver for cross-chain credit system (MVP version)
 * @notice Handles cross-chain messages to credit internal balances on Hedera
 * 
 * This is a simplified implementation for MVP that can be extended to use
 * full Chainlink CCIP integration in the future.
 */
contract CCIPReceiver is Ownable {
    // Events
    event CreditReceived(
        address indexed user,
        uint256 amount,
        uint64 sourceChain,
        bytes32 messageId,
        address indexed sender
    );
    
    event RouterUpdated(
        address indexed oldRouter,
        address indexed newRouter
    );
    
    event SourceChainUpdated(
        uint64 oldSourceChain,
        uint64 newSourceChain
    );
    
    event EscrowGameUpdated(
        address indexed oldEscrowGame,
        address indexed newEscrowGame
    );

    // Storage
    address public escrowGame;
    address public trustedRouter;
    uint64 public trustedSourceChain;
    
    // Message structure for cross-chain communication
    struct CreditMessage {
        address user;
        uint256 amount;
        uint64 sourceChain;
        bytes32 messageId;
    }
    
    // Track processed messages to prevent replay attacks
    mapping(bytes32 => bool) public processedMessages;
    
    // Statistics
    uint256 public totalCreditsProcessed;
    uint256 public totalAmountCredited;
    mapping(address => uint256) public userCreditCount;

    // Modifiers
    modifier onlyTrustedRouter() {
        require(msg.sender == trustedRouter, "Only trusted router can call this");
        _;
    }
    
    modifier messageNotProcessed(bytes32 messageId) {
        require(!processedMessages[messageId], "Message already processed");
        _;
    }

    constructor(
        address _router,
        address _escrowGame,
        uint64 _trustedSourceChain
    ) Ownable(msg.sender) {
        require(_router != address(0), "Invalid router address");
        require(_escrowGame != address(0), "Invalid escrow game address");
        
        trustedRouter = _router;
        escrowGame = _escrowGame;
        trustedSourceChain = _trustedSourceChain;
        
        emit RouterUpdated(address(0), _router);
        emit EscrowGameUpdated(address(0), _escrowGame);
        emit SourceChainUpdated(0, _trustedSourceChain);
    }

    /**
     * @dev Handle incoming cross-chain message (simplified for MVP)
     * @param messageId Unique message identifier for tracking
     * @param sourceChain Source chain selector
     * @param data Encoded message data containing user and amount
     * @param sender Address that sent the message (for verification)
     */
    function handleMessage(
        bytes32 messageId,
        uint64 sourceChain,
        bytes calldata data,
        address sender
    ) external onlyTrustedRouter messageNotProcessed(messageId) {
        // Validate source chain
        require(sourceChain == trustedSourceChain, "Invalid source chain");
        
        // Decode message
        CreditMessage memory creditMsg = abi.decode(data, (CreditMessage));
        
        // Validate message
        require(creditMsg.user != address(0), "Invalid user address");
        require(creditMsg.amount > 0, "Invalid amount");
        require(creditMsg.sourceChain == sourceChain, "Source chain mismatch");
        require(creditMsg.messageId == messageId, "Message ID mismatch");
        
        // Mark message as processed
        processedMessages[messageId] = true;
        
        // Credit the user via EscrowGame
        (bool success, ) = escrowGame.call(
            abi.encodeWithSignature(
                "addInternalCredits(address,uint256,uint64)",
                creditMsg.user,
                creditMsg.amount,
                sourceChain
            )
        );
        
        require(success, "Failed to credit user");
        
        // Update statistics
        totalCreditsProcessed++;
        totalAmountCredited += creditMsg.amount;
        userCreditCount[creditMsg.user]++;
        
        emit CreditReceived(
            creditMsg.user,
            creditMsg.amount,
            sourceChain,
            messageId,
            sender
        );
    }

    /**
     * @dev Simulate a cross-chain message for testing (only owner)
     * @param user User address to credit
     * @param amount Amount to credit
     * @param sourceChain Source chain ID
     */
    function simulateCrossChainCredit(
        address user,
        uint256 amount,
        uint64 sourceChain
    ) external onlyOwner {
        require(user != address(0), "Invalid user address");
        require(amount > 0, "Invalid amount");
        
        // Generate a unique message ID for simulation
        bytes32 messageId = keccak256(
            abi.encodePacked(
                user,
                amount,
                sourceChain,
                block.timestamp,
                block.number
            )
        );
        
        // Credit the user via EscrowGame
        (bool success, ) = escrowGame.call(
            abi.encodeWithSignature(
                "addInternalCredits(address,uint256,uint64)",
                user,
                amount,
                sourceChain
            )
        );
        
        require(success, "Failed to credit user");
        
        // Update statistics
        totalCreditsProcessed++;
        totalAmountCredited += amount;
        userCreditCount[user]++;
        
        emit CreditReceived(
            user,
            amount,
            sourceChain,
            messageId,
            msg.sender
        );
    }

    /**
     * @dev Update trusted router
     * @param _router New router address
     */
    function setTrustedRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router address");
        
        address oldRouter = trustedRouter;
        trustedRouter = _router;
        
        emit RouterUpdated(oldRouter, _router);
    }

    /**
     * @dev Update trusted source chain
     * @param _sourceChain New source chain selector
     */
    function setTrustedSourceChain(uint64 _sourceChain) external onlyOwner {
        uint64 oldSourceChain = trustedSourceChain;
        trustedSourceChain = _sourceChain;
        
        emit SourceChainUpdated(oldSourceChain, _sourceChain);
    }

    /**
     * @dev Update escrow game address
     * @param _escrowGame New escrow game address
     */
    function setEscrowGame(address _escrowGame) external onlyOwner {
        require(_escrowGame != address(0), "Invalid escrow game address");
        
        address oldEscrowGame = escrowGame;
        escrowGame = _escrowGame;
        
        emit EscrowGameUpdated(oldEscrowGame, _escrowGame);
    }

    /**
     * @dev Check if a message has been processed
     * @param messageId Message ID to check
     * @return processed True if message has been processed
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool processed) {
        return processedMessages[messageId];
    }

    /**
     * @dev Get contract statistics
     * @return _totalCreditsProcessed Total number of credits processed
     * @return _totalAmountCredited Total amount credited
     * @return _processedMessageCount Number of processed messages
     */
    function getStatistics() external view returns (
        uint256 _totalCreditsProcessed,
        uint256 _totalAmountCredited,
        uint256 _processedMessageCount
    ) {
        _totalCreditsProcessed = totalCreditsProcessed;
        _totalAmountCredited = totalAmountCredited;
        
        // Count processed messages (this is a simplified count)
        _processedMessageCount = totalCreditsProcessed;
    }

    /**
     * @dev Get user credit statistics
     * @param user User address
     * @return creditCount Number of credits received by user
     */
    function getUserCreditCount(address user) external view returns (uint256 creditCount) {
        return userCreditCount[user];
    }

    /**
     * @dev Get supported tokens (empty for this implementation)
     * @return tokens Array of supported tokens
     */
    function getSupportedTokens() external pure returns (address[] memory tokens) {
        // No tokens supported in this implementation
        tokens = new address[](0);
    }

    /**
     * @dev Emergency function to recover stuck tokens
     * @param token Token address (address(0) for native)
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        
        if (token == address(0)) {
            // Native token
            require(address(this).balance >= amount, "Insufficient balance");
            payable(to).transfer(amount);
        } else {
            // ERC20 token
            IERC20(token).transfer(to, amount);
        }
    }

    /**
     * @dev Pause message processing (emergency function)
     * @param messageId Message ID to mark as processed without processing
     */
    function emergencyPauseMessage(bytes32 messageId) external onlyOwner {
        processedMessages[messageId] = true;
    }
}

// Interface for ERC20 (minimal)
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}
