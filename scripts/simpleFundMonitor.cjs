#!/usr/bin/env node

// Use ES modules instead of CommonJS
import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current file's directory (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs directly from JSON files
const factoryABIPath = path.join(__dirname, '../src/contracts/RegenThemFundFactory.json');
const fundABIPath = path.join(__dirname, '../src/contracts/RegenThemFund.json');

const factoryABI = JSON.parse(fs.readFileSync(factoryABIPath, 'utf8'));
const fundABI = JSON.parse(fs.readFileSync(fundABIPath, 'utf8'));

const FACTORY_ADDRESS = factoryABI.contractAddress;
const RPC_URL = "https://sepolia.base.org";

// Function to monitor funds
async function monitorFunds() {
  try {
    console.log("Connecting to Base Sepolia...");
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    
    console.log("Creating factory contract instance...");
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS, 
      factoryABI.abi, 
      provider
    );
    
    // Set up event listener for fund creation
    console.log("Setting up event listener for fund creation...");
    factoryContract.on("RegenThemFundCreated", 
      (owner, fundAddress, name, goalAmount, event) => {
        console.log("\n🔔 NEW FUND CREATED!");
        console.log("------------------------");
        console.log("Name:", name);
        console.log("Address:", fundAddress);
        console.log("Owner:", owner);
        console.log("Goal Amount:", ethers.utils.formatUnits(goalAmount, 18));
        console.log("------------------------\n");
      }
    );
    
    // Initial fund check
    console.log("Checking existing funds...");
    const funds = await factoryContract.getRegenThemFundContracts();
    console.log(`Found ${funds.length} existing funds:`);
    
    for (let i = 0; i < funds.length; i++) {
      const fundAddress = funds[i];
      console.log(`\nFund #${i+1}: ${fundAddress}`);
      
      try {
        const fundContract = new ethers.Contract(fundAddress, fundABI.abi, provider);
        const name = await fundContract.getName();
        const description = await fundContract.getDescription();
        const goal = await fundContract.getGoalAmount();
        const balance = await fundContract.getCurrentBalance();
        
        console.log("Name:", name);
        console.log("Description:", description);
        console.log("Goal:", ethers.utils.formatUnits(goal, 18));
        console.log("Current Balance:", ethers.utils.formatUnits(balance, 18));
      } catch (err) {
        console.log("Error fetching fund details:", err.message);
      }
    }
    
    console.log("\n👀 Monitoring for new funds... (Press Ctrl+C to exit)");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run the monitoring function
monitorFunds();

// Keep the process running
process.stdin.resume();
console.log("Script running. Press Ctrl+C to exit."); 