#!/usr/bin/env ts-node
const { loadAllFundsData } = require('../src/utils/fundDataFetcher');

// Track funds to show changes
let previousFunds: Record<string, any> = {};
let isFirstRun = true;

// Clear console function for cleaner output
const clearConsole = () => {
  process.stdout.write('\x1Bc');
};

// Format time for display
const getTimeStamp = () => {
  const now = new Date();
  return now.toLocaleTimeString();
};

async function checkFunds() {
  try {
    // Show loading message
    process.stdout.write(`[${getTimeStamp()}] Fetching latest fund data...\r`);
    
    const funds = await loadAllFundsData();
    clearConsole();
    
    console.log(`\n🔄 FUND MONITOR - Last updated: ${getTimeStamp()}`);
    console.log(`================================================\n`);
    
    if (funds.length === 0) {
      console.log("No funds found on chain.");
      return;
    }

    console.log(`📊 Found ${funds.length} funds:\n`);
    
    funds.forEach((fund, index) => {
      // Check if this is a new fund or has changes
      const isNewFund = !previousFunds[fund.address];
      const hasDonation = !isNewFund && previousFunds[fund.address].currentBalance !== fund.currentBalance;
      
      // Visual indicators for changes
      const changeIndicator = isFirstRun ? '' : 
                             isNewFund ? '🆕 ' :
                             hasDonation ? '💰 ' : '';
      
      console.log(`${changeIndicator}Fund #${index + 1}: ${fund.name}`);
      console.log(`- Address: ${fund.address}`);
      console.log(`- Description: ${fund.description.substring(0, 60)}${fund.description.length > 60 ? '...' : ''}`);
      console.log(`- Goal: $${fund.goal.toLocaleString()}`);
      
      // Highlight balance changes
      if (hasDonation) {
        const prevBalance = previousFunds[fund.address].currentBalance;
        const difference = fund.currentBalance - prevBalance;
        console.log(`- Current Balance: $${fund.currentBalance.toLocaleString()} (+$${difference.toLocaleString()})`);
      } else {
        console.log(`- Current Balance: $${fund.currentBalance.toLocaleString()}`);
      }
      
      console.log(`- Progress: ${fund.progress}%`);
      console.log(`- Owner: ${fund.owner}`);
      console.log(''); // Empty line between funds
    });
    
    // Update the previous funds for the next comparison
    previousFunds = funds.reduce((acc, fund) => {
      acc[fund.address] = fund;
      return acc;
    }, {} as Record<string, any>);
    
    isFirstRun = false;
    
    console.log(`\n⏱️  Monitoring... (press Ctrl+C to exit)`);
  } catch (error) {
    console.error(`\n❌ Error monitoring funds: ${error}`);
  }
}

// Run once immediately
checkFunds();

// Then set up interval
const intervalId = setInterval(checkFunds, 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  clearInterval(intervalId);
  console.log('\n\n👋 Monitoring stopped. Goodbye!');
  process.exit(0);
}); 