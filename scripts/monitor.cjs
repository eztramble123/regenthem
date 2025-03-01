#!/usr/bin/env node

const { ethers } = require('ethers');

// Define contract address and ABI directly
const FACTORY_ADDRESS = "0xC77E8005a3d6bD632999373da027ACf6F478E696";
const FACTORY_ABI = [
  {
    "type": "event",
    "name": "RegenThemFundCreated",
    "inputs": [
      {"name": "owner", "type": "address", "indexed": true},
      {"name": "regenThemFundAddress", "type": "address", "indexed": false},
      {"name": "name", "type": "string", "indexed": false},
      {"name": "goalAmount", "type": "uint256", "indexed": false}
    ],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "getRegenThemFundContracts",
    "inputs": [],
    "outputs": [{"name": "", "type": "address[]"}],
    "stateMutability": "view"
  }
];

async function monitorFunds() {
  try {
    console.log("Connecting to Base Sepolia...");
    const provider = new ethers.providers.JsonRpcProvider("https://sepolia.base.org");
    
    console.log("Creating contract instance...");
    const contract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    
    // Initial check
    const funds = await contract.getRegenThemFundContracts();
    console.log(`Found ${funds.length} funds:`, funds);
    
    // Monitor for new funds
    console.log("Monitoring for new funds...");
    contract.on("RegenThemFundCreated", (owner, address, name, goal) => {
      console.log("\n🔔 NEW FUND CREATED!");
      console.log(`Name: ${name}`);
      console.log(`Address: ${address}`);
      console.log(`Owner: ${owner}`);
      console.log(`Goal: ${ethers.utils.formatUnits(goal, 18)}`);
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

monitorFunds();
process.stdin.resume(); 