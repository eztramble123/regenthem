# RegenThem - Seamless Fundraising Platform - give back to those that need it most

RegenThem is a decentralized fundraising platform built on Base that allows users to create and contribute to fundraising campaigns using USDC tokens. The platform provides a seamless integration between blockchain smart contracts and a modern web interface.

## Why

rizz

## Overview

RegenThem consists of:

- **Smart Contracts**: contracts for managing fundraising campaigns
- **Web Interface**: A Next.js application providing an intuitive UI for creating and contributing to campaigns

## Features

- Create fundraising campaigns with custom names, descriptions, and target goals
- Contribute USDC tokens to existing campaigns
- Track campaign progress and funding statistics
- Withdraw funds once targets are reached (campaign owners only)
- Web3 wallet integration for secure transactions

## Tech Stack

### Frontend

- OnchainKit & Coinbase SDK
- Farcaster Frame SDK
- Next.js
- React
- Wagmi
- TypeScript
- TailwindCSS
- shadcn/ui components

### Backend

- Solidity smart contracts
- Foundry
- ERC20 token integration (USDC)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Metamask or other Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/eztramble123/regenthem/tree/main
cd regenthem

# Install dependencies
npm install
# or
yarn install

# Start the development server
npm run dev
# or
yarn dev
```

### Smart Contract Development

The smart contracts are located in the `backend/contracts` directory and use Foundry for development:

```bash
cd backend/contracts

# Build contracts
forge build

# Run tests
forge test

# Deploy (requires configuration)
forge script script/Deploy.s.sol:DeployScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

## How It Works

1. Users connect their Web3 wallet to the application
2. Campaign creators can define new fundraising projects with goals
3. Contributors can browse available campaigns and donate USDC
4. Smart contracts manage the funds securely on-chain
5. Campaign owners can withdraw funds when goals are reached

## Project Structure

- `/src`: Frontend application code
  - `/app`: Next.js application pages
  - `/components`: Reusable UI components
  - `/contracts`: Contract ABIs
  - `/lib`: Utility functions
  - `/types`: TypeScript type definitions
- `/backend`: Smart contract code
  - `/contracts`: Solidity smart contracts
    - `/src`: Contract source code
    - `/test`: Contract tests
