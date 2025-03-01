import { ethers } from "ethers";
import FactoryABI from "../contracts/RegenThemFundFactory.json";
import RegenThemFundABI from "../contracts/RegenThemFund.json";

// Contract address
const FACTORY_ADDRESS = FactoryABI.contractAddress;

// Interface for project/fund data
export interface FundData {
  address: string;
  name: string;
  description: string;
  image: string;
  goal: number;
  currentBalance: number;
  totalRaised: number;
  progress: number;
  owner: string;
}

/**
 * Fetch all funds from the factory contract
 */
export async function fetchAllFunds(): Promise<string[]> {
  try {
    // Create a provider - using ethers directly without window.ethereum dependency
    const provider = new ethers.providers.JsonRpcProvider(
      "https://sepolia.base.org",
    );

    // Create factory contract instance
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      FactoryABI.abi,
      provider,
    );

    // Get all fund addresses
    const fundAddresses = await factoryContract.getRegenThemFundContracts();
    console.log(`Found ${fundAddresses.length} funds:`, fundAddresses);
    return fundAddresses;
  } catch (error) {
    console.error("Error fetching funds from factory:", error);
    return [];
  }
}

/**
 * Fetch detailed data for a single fund
 */
export async function fetchFundData(address: string): Promise<FundData | null> {
  try {
    // Create a provider
    const provider = new ethers.providers.JsonRpcProvider(
      "https://sepolia.base.org",
    );

    // Create fund contract instance
    const contract = new ethers.Contract(
      address,
      RegenThemFundABI.abi,
      provider,
    );

    // Fetch all data in parallel
    const [
      name,
      description,
      goalAmount,
      currentBalance,
      totalRaised,
      progress,
      owner,
    ] = await Promise.all([
      contract.getName(),
      contract.getDescription(),
      contract.getGoalAmount(),
      contract.getCurrentBalance(),
      contract.getTotalRaised(),
      contract.getProgress(),
      contract.getOwner(),
    ]);

    // Generate placeholder image based on fund address
    const imageHash = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes(address))
      .slice(2, 10);
    const image = `https://picsum.photos/seed/${imageHash}/400/300`;

    return {
      address,
      name,
      description,
      image,
      goal: Number(ethers.utils.formatUnits(goalAmount, 18)),
      currentBalance: Number(ethers.utils.formatUnits(currentBalance, 18)),
      totalRaised: Number(ethers.utils.formatUnits(totalRaised, 18)),
      progress: Number(progress),
      owner,
    };
  } catch (error) {
    console.error(`Error fetching data for fund ${address}:`, error);
    return null;
  }
}

/**
 * Load all funds with their detailed data
 */
export async function loadAllFundsData(): Promise<FundData[]> {
  try {
    // Get all fund addresses
    const addresses = await fetchAllFunds();

    if (addresses.length === 0) {
      console.log("No funds found");
      return [];
    }

    // Fetch data for each fund in parallel
    const fundsDataPromises = addresses.map((address) =>
      fetchFundData(address),
    );
    const fundsData = await Promise.all(fundsDataPromises);

    // Filter out null values (failed fetches)
    return fundsData.filter((fund) => fund !== null) as FundData[];
  } catch (error) {
    console.error("Error loading all funds data:", error);
    return [];
  }
}

// Add this debug function to your fundDataFetcher.ts
export async function debugContract() {
  try {
    console.log("===== CONTRACT DEBUG =====");
    const provider = new ethers.providers.JsonRpcProvider(
      "https://sepolia.base.org",
    );

    // Test provider connection
    const blockNumber = await provider.getBlockNumber();
    console.log("Connected to network. Block number:", blockNumber);

    // Check factory contract
    console.log("Factory address:", FACTORY_ADDRESS);
    const factoryContract = new ethers.Contract(
      FACTORY_ADDRESS,
      FactoryABI.abi,
      provider,
    );

    // Test contract methods
    console.log("Testing getRegenThemFundContracts...");
    const funds = await factoryContract.getRegenThemFundContracts();
    console.log("Raw funds data:", funds);

    return { success: true, funds };
  } catch (error) {
    console.error("Contract debug failed:", error);
    return { success: false, error };
  }
}
