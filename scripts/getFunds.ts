#!/usr/bin/env ts-node
import { loadAllFundsData } from '../src/utils/fundDataFetcher';

async function main() {
  console.log("Fetching all funds data...");
  const funds = await loadAllFundsData();
  
  if (funds.length === 0) {
    console.log("No funds found.");
    return;
  }
  
  console.log(`Found ${funds.length} funds:`);
  funds.forEach((fund, index) => {
    console.log(`\nFund #${index + 1}: ${fund.name}`);
    console.log(`- Address: ${fund.address}`);
    console.log(`- Description: ${fund.description}`);
    console.log(`- Goal: $${fund.goal.toLocaleString()}`);
    console.log(`- Current Balance: $${fund.currentBalance.toLocaleString()}`);
    console.log(`- Progress: ${fund.progress}%`);
    console.log(`- Owner: ${fund.owner}`);
  });
}

main().catch(error => {
  console.error("Error running script:", error);
  process.exit(1);
}); 