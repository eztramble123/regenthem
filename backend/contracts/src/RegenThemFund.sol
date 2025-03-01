// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract RegenThemFund {
    mapping(address => uint256) private s_addressToAmountFunded;
    address[] private s_funders;
    IERC20 private s_usdcToken;
    
    // Add the specific USDC token address - sepolia testnet
    address private constant USDC_TOKEN_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Add name and description for the fundraising campaign
    string private s_name;
    string private s_description;
    
    // Add goal amount and tracking variables
    uint256 private s_goalAmount;
    uint256 private s_currentBalance;
    uint256 private s_totalRaised;

    address private immutable i_owner;
    uint256 private constant MINIMUM_USD = 1 * 10 ** 16;

    event Funded(address indexed funder, uint256 value);
    event GoalReached(uint256 amount);
    event WithdrawnFunds(uint256 amount);

    error RegenThemFund__NotOwner(address sender);
    error RegenThemFund__TransferFailed();
    error RegenThemFund__InvalidTokenAddress();

    modifier onlyOwner() {
        if (msg.sender != i_owner) revert RegenThemFund__NotOwner(msg.sender);
        _;
    }

    constructor(address usdcToken, string memory name, string memory description, uint256 goalAmount, address fundOwner) {
        i_owner = fundOwner;
        // Validate that only the specific USDC token can be used
        if (usdcToken != USDC_TOKEN_ADDRESS) revert RegenThemFund__InvalidTokenAddress();
        s_usdcToken = IERC20(usdcToken);
        s_name = name;
        s_description = description;
        s_goalAmount = goalAmount;
        s_currentBalance = 0;
        s_totalRaised = 0;
    }

    receive() external payable {
        uint256 usdcAmount = msg.value; // Example: set usdcAmount equal to msg.value for demonstration
        fund(usdcAmount);
    }

    fallback() external payable {
        uint256 usdcAmount = msg.value; // Example: set usdcAmount equal to msg.value for demonstration
        fund(usdcAmount);
    }

    function fund(uint256 usdcAmount) public {
        require(usdcAmount >= MINIMUM_USD, "You need to send more USDC!");
        s_usdcToken.transferFrom(msg.sender, address(this), usdcAmount);
        s_addressToAmountFunded[msg.sender] += usdcAmount;
        s_funders.push(msg.sender);
        
        // Update tracking variables
        s_currentBalance += usdcAmount;
        s_totalRaised += usdcAmount;
        
        // Check if goal has been reached
        if (s_currentBalance >= s_goalAmount && s_goalAmount > 0) {
            emit GoalReached(s_currentBalance);
        }

        emit Funded(msg.sender, usdcAmount);
    }

    function withdraw() public onlyOwner {
        uint256 fundersLength = s_funders.length;
        uint256 balance = s_usdcToken.balanceOf(address(this));

        for (uint256 funderIndex = 0; funderIndex < fundersLength; funderIndex++) {
            address funder = s_funders[funderIndex];
            s_addressToAmountFunded[funder] = 0;
        }

        s_funders = new address[](0);
        
        // Update current balance
        s_currentBalance = 0;
        
        bool success = s_usdcToken.transfer(msg.sender, balance);
        if (!success) revert RegenThemFund__TransferFailed();
        
        emit WithdrawnFunds(balance);
    }

    /**
     * View/Pure functions (Getters)
     */

    function getAddressToAmountFunded(address fundingAddress) external view returns (uint256) {
        return s_addressToAmountFunded[fundingAddress];
    }

    function getFunder(uint256 index) external view returns (address) {
        return s_funders[index];
    }

    function getOwner() external view returns (address) {
        return i_owner;
    }

    function getMinimumUsd() external pure returns (uint256) {
        return MINIMUM_USD;
    }

    // Add getters for name and description
    function getName() external view returns (string memory) {
        return s_name;
    }

    function getDescription() external view returns (string memory) {
        return s_description;
    }
    
    // Add getters for goal and tracking variables
    function getGoalAmount() external view returns (uint256) {
        return s_goalAmount;
    }
    
    function getCurrentBalance() external view returns (uint256) {
        return s_currentBalance;
    }
    
    function getTotalRaised() external view returns (uint256) {
        return s_totalRaised;
    }
    
    function getProgress() external view returns (uint256) {
        if (s_goalAmount == 0) return 0;
        return (s_currentBalance * 100) / s_goalAmount;
    }
}