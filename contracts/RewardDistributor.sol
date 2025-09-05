// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title RewardDistributor
 * @dev Contract for distributing IAS tokens to affiliates based on click tracking
 * Supports both batch distributions and off-chain signature claims
 */
contract RewardDistributor is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public iasToken;
    
    // Track claimed rewards to prevent double claiming
    mapping(address => mapping(uint256 => bool)) public claimedRewards;
    
    // Track total distributed rewards
    mapping(address => uint256) public totalDistributed;
    uint256 public globalTotalDistributed;
    
    // Events
    event RewardDistributed(address indexed affiliate, uint256 amount, uint256 epoch);
    event BatchRewardDistributed(address[] affiliates, uint256[] amounts, uint256 epoch);
    event RewardClaimed(address indexed affiliate, uint256 amount, uint256 epoch);
    
    constructor(address _iasToken) {
        iasToken = IERC20(_iasToken);
    }
    
    /**
     * @dev Batch distribute rewards to multiple affiliates
     * @param affiliates Array of affiliate addresses
     * @param amounts Array of reward amounts
     * @param epoch Current epoch/period identifier
     */
    function batchDistributeRewards(
        address[] calldata affiliates,
        uint256[] calldata amounts,
        uint256 epoch
    ) external onlyOwner nonReentrant {
        require(affiliates.length == amounts.length, "Arrays length mismatch");
        require(affiliates.length > 0, "Empty arrays");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(iasToken.balanceOf(address(this)) >= totalAmount, "Insufficient token balance");
        
        for (uint256 i = 0; i < affiliates.length; i++) {
            require(!claimedRewards[affiliates[i]][epoch], "Reward already distributed for this epoch");
            
            claimedRewards[affiliates[i]][epoch] = true;
            totalDistributed[affiliates[i]] += amounts[i];
            globalTotalDistributed += amounts[i];
            
            require(iasToken.transfer(affiliates[i], amounts[i]), "Token transfer failed");
            
            emit RewardDistributed(affiliates[i], amounts[i], epoch);
        }
        
        emit BatchRewardDistributed(affiliates, amounts, epoch);
    }
    
    /**
     * @dev Claim rewards with off-chain signature
     * @param amount Amount to claim
     * @param epoch Epoch identifier
     * @param signature Admin signature authorizing the claim
     */
    function claimReward(
        uint256 amount,
        uint256 epoch,
        bytes calldata signature
    ) external nonReentrant {
        require(!claimedRewards[msg.sender][epoch], "Reward already claimed for this epoch");
        require(amount > 0, "Amount must be greater than 0");
        
        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, amount, epoch, address(this))
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        
        require(
            ethSignedMessageHash.recover(signature) == owner(),
            "Invalid signature"
        );
        
        require(iasToken.balanceOf(address(this)) >= amount, "Insufficient token balance");
        
        claimedRewards[msg.sender][epoch] = true;
        totalDistributed[msg.sender] += amount;
        globalTotalDistributed += amount;
        
        require(iasToken.transfer(msg.sender, amount), "Token transfer failed");
        
        emit RewardClaimed(msg.sender, amount, epoch);
    }
    
    /**
     * @dev Check if reward has been claimed for specific epoch
     */
    function hasClaimedReward(address affiliate, uint256 epoch) external view returns (bool) {
        return claimedRewards[affiliate][epoch];
    }
    
    /**
     * @dev Get total distributed amount for affiliate
     */
    function getAffiliateTotal(address affiliate) external view returns (uint256) {
        return totalDistributed[affiliate];
    }
    
    /**
     * @dev Emergency withdrawal function for owner
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        require(iasToken.transfer(owner(), amount), "Token transfer failed");
    }
    
    /**
     * @dev Update IAS token contract address
     */
    function updateIASToken(address _newToken) external onlyOwner {
        iasToken = IERC20(_newToken);
    }
}