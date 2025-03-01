// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {RegenThemFundFactory} from "../src/RegenThemFundFactory.sol";

contract DeployRegenThemFund is Script {
    function run() public {
        // Read private key from environment variable
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the factory contract
        RegenThemFundFactory factory = new RegenThemFundFactory();
        
        // Optionally, create an initial fund to test
        factory.createRegenThemFund("First Fund", "Test description for the first fund", 100 * 10**18);
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        // Log the factory address for reference
        vm.toString(address(factory));
    }
} 