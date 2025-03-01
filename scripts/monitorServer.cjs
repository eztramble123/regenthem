#!/usr/bin/env node
const { ethers } = require('ethers');
const WebSocket = require('ws');
const http = require('http');

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

// Create HTTP server
const server = http.createServer();
const wss = new WebSocket.Server({ server });
const PORT = 3001;

// Store connected clients
const clients = new Set();

// Add these constants at the top of the file
const MIN_BROADCAST_INTERVAL = 15000; // 15 seconds minimum between broadcasts
let lastBroadcastTime = 0;
let pendingBroadcasts = [];

// Add after server initialization
let connectionCount = 0;

// Handle WebSocket connections
wss.on('connection', (ws) => {
  connectionCount++;
  console.log(`Client connected (total: ${connectionCount})`);
  clients.add(ws);
  
  // Instead, just send a simple connection confirmation
  ws.send(JSON.stringify({
    type: 'connection_status',
    data: { connected: true }
  }));
  
  ws.on('close', () => {
    connectionCount--;
    console.log(`Client disconnected (total: ${connectionCount})`);
    clients.delete(ws);
  });
});

// Replace the broadcast function with this throttled version
function broadcast(data) {
  const now = Date.now();
  
  // Add this broadcast to pending list
  pendingBroadcasts.push(data);
  
  // If we're within the rate limit window, schedule for later
  if (now - lastBroadcastTime < MIN_BROADCAST_INTERVAL) {
    // Only schedule if we haven't already
    if (pendingBroadcasts.length === 1) {
      const waitTime = MIN_BROADCAST_INTERVAL - (now - lastBroadcastTime);
      console.log(`Rate limiting: Will send updates in ${waitTime}ms`);
      
      setTimeout(() => {
        processPendingBroadcasts();
      }, waitTime);
    }
    return;
  }
  
  // If we're outside the rate limit window, process immediately
  processPendingBroadcasts();
}

// Add this function to handle batched broadcasts
function processPendingBroadcasts() {
  if (pendingBroadcasts.length === 0) return;
  
  console.log(`Processing ${pendingBroadcasts.length} pending updates`);
  
  // Combine similar messages where possible
  const combinedData = {
    type: 'batch_update',
    updates: pendingBroadcasts
  };
  
  // Send to all clients
  const message = JSON.stringify(combinedData);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
  
  // Reset tracking variables
  lastBroadcastTime = Date.now();
  pendingBroadcasts = [];
}

// Start monitoring the blockchain
async function monitorFunds() {
  try {
    console.log("Connecting to Base Sepolia...");
    const provider = new ethers.providers.JsonRpcProvider("https://sepolia.base.org");
    
    console.log("Creating contract instance...");
    const contract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    
    // KEEP ONLY this part - monitoring for new funds
    console.log("Monitoring for new funds...");
    contract.on("RegenThemFundCreated", (owner, address, name, goal) => {
      console.log("\n🔔 NEW FUND CREATED!");
      console.log(`Name: ${name}`);
      console.log(`Address: ${address}`);
      
      // Broadcast to all connected clients
      broadcast({
        type: 'new_fund',
        data: {
          owner,
          address,
          name,
          goal: ethers.utils.formatUnits(goal, 18)
        }
      });
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Start server and blockchain monitoring
server.listen(PORT, () => {
  console.log(`WebSocket server running at ws://localhost:${PORT}`);
  monitorFunds();
});

console.log("Press Ctrl+C to exit"); 