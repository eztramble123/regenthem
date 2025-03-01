// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./RegenThemFund.sol"; 

contract RegenThemFundFactory {
    RegenThemFund[] public regenThemFundContracts;
    // Add the specific USDC token address
    address private constant USDC_TOKEN_ADDRESS = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    event RegenThemFundCreated(address indexed owner, address regenThemFundAddress, string name, uint256 goalAmount);

    function createRegenThemFund(string memory name, string memory description, uint256 goalAmount) external {

        RegenThemFund newRegenThemFund = new RegenThemFund(
            USDC_TOKEN_ADDRESS, 
            name, 
            description, 
            goalAmount,
            msg.sender  
        );
        regenThemFundContracts.push(newRegenThemFund);
        emit RegenThemFundCreated(msg.sender, address(newRegenThemFund), name, goalAmount);
    }

    function getRegenThemFundContracts() external view returns (RegenThemFund[] memory) {
        return regenThemFundContracts;
    }
} 