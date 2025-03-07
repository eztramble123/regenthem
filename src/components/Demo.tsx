import { useEffect, useCallback, useState } from "react";
import sdk from "@farcaster/frame-sdk";
import { FundButton } from "@coinbase/onchainkit/fund";
import { Plus } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { ethers } from "ethers";

import {
  useAccount,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useContractRead,
  useWriteContract,
  useChainId,
  useSwitchChain,
} from "wagmi";

import { config } from "../components/providers/WagmiProvider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Import contract ABIs
import FactoryABI from "../contracts/RegenThemFundFactory.json";

// Import the fund fetcher utilities
import { fetchFundData, debugContract } from "../utils/fundDataFetcher";
import FundCard from "./FundCard";

// Import the useMonitorWebSocket hook
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";

// Import the USDC constants
import { USDC_ADDRESS } from "../constants/addresses";
import Image from "next/image";

// Contract addresses - update with your deployed addresses
const FACTORY_ADDRESS = FactoryABI.contractAddress;

// Add this interface near the top of the file, after imports
interface Project {
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

// Define the form schema using zod
const formSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Fund Name must be at least 2 characters." }),
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters." }),
  image: z.string().url({ message: "Image must be a valid URL." }),
  goal: z.preprocess(
    (val) => Number(val),
    z.number().min(1, { message: "Goal amount must be at least 1." }),
  ),
});

// Add this near your other form schema
const donationFormSchema = z.object({
  amount: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, { message: "Amount must be at least 0.01 USDC." }),
  ),
});

// Add the USDC contract ABI (abbreviated version)
const USDC_ABI = [
  {
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

console.log("Factory address:", FACTORY_ADDRESS);
console.log("Has ABI:", !!FactoryABI.abi);

export default function Demo() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading] = useState(false);
  const [pendingFunds, setPendingFunds] = useState<
    { name: string; description: string }[]
  >([]);
  const [showDonateDialog, setShowDonateDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Read all funds from factory contract
  useContractRead({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: FactoryABI.abi,
    functionName: "getRegenThemFundContracts",
    chainId: config.chains[0].id,
  });

  // Replace the deprecated hook
  const {
    writeContract: createFund,
    isPending: isCreatingFund,
    data: createFundTxHash,
  } = useWriteContract();

  // Track transaction status if needed
  useWaitForTransactionReceipt({
    hash: createFundTxHash,
  });

  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  // Form for creating new projects
  const projectForm = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      image: "",
      goal: 1,
    },
  });

  // Update the donationForm initialization with the schema
  const donationForm = useForm({
    resolver: zodResolver(donationFormSchema),
    defaultValues: {
      amount: 5, // Default preset amount
    },
  });

  // Keep just a minimal version of loadFundsData for manual refreshes
  const loadFundsData = useCallback(async () => {
    // Don't need this for normal operation, only for manual reloads
    // Keep it minimal
  }, []);

  // Remove the automatic loadFundsData call on mount
  useEffect(() => {
    // Skip the loadFundsData call
    // This was causing the issues with existing contracts
  }, [loadFundsData]);

  // Also remove the refresh interval
  useEffect(() => {
    if (!isConnected) return;

    // Instead of setting up interval to load all funds,
    // we just rely on the WebSocket for new funds

    return () => {
      // No cleanup needed
    };
  }, [isConnected]);

  // Update your submit function to include the image
  const onSubmitProject = async (values: {
    goal: { toString: () => string };
    name: unknown;
    description: unknown;
    image: string;
  }) => {
    // Check if on the correct network
    if (chainId !== config.chains[0].id) {
      toast.info("Switching to Base Sepolia testnet...");
      try {
        await switchChain({ chainId: config.chains[0].id });
        return;
      } catch (error) {
        console.error("Failed to switch network:", error);
        toast.error("Please switch to Base Sepolia testnet manually");
        return;
      }
    }

    try {
      const goalInWei = ethers.utils.parseUnits(values.goal.toString(), 18);

      // Save the image value for later
      const imageUrl = values.image || ""; // Use empty string if image is not provided

      // Check image URL is valid (optional)
      const isImageValid = imageUrl === "" || imageUrl.startsWith("http");

      // Add to pending funds with image
      setPendingFunds((prev) => [
        ...prev,
        {
          name: values.name as string,
          description: values.description as string,
          image: isImageValid ? imageUrl : "", // Only use the image if it's valid
        },
      ]);

      // Create the fund on the blockchain
      createFund({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FactoryABI.abi,
        functionName: "createRegenThemFund",
        args: [values.name, values.description, goalInWei],
      });

      // Store image URL in localStorage
      if (isImageValid && imageUrl) {
        const fundImages = JSON.parse(
          localStorage.getItem("fundImages") || "{}",
        );
        fundImages[values.name as string] = imageUrl;
        localStorage.setItem("fundImages", JSON.stringify(fundImages));
      }

      // Only show transaction submitted toast (not fund created - WebSocket will handle that)
      toast.success("Transaction submitted!");

      // Reset form
      projectForm.reset();

      // Force close the dialog with a short delay to ensure state updates properly
      setTimeout(() => {
        setShowCreateDialog(false);
        console.log("Dialog should be closed now");
      }, 100);
    } catch (error) {
      console.error("Error creating fund:", error);
      toast.error("Failed to create fund");
    }
  };

  // Update this effect to properly handle transaction receipt
  useEffect(() => {
    if (!createFundTxHash) return;

    console.log("Detected new transaction:", createFundTxHash);

    const checkReceipt = async () => {
      try {
        const provider = new ethers.providers.JsonRpcProvider(
          "https://sepolia.base.org",
        );
        const receipt = await provider.getTransactionReceipt(createFundTxHash);

        if (receipt && receipt.confirmations > 0) {
          console.log("Transaction confirmed:", receipt);

          // Force reload all funds data
          loadFundsData();

          // Clear pending funds after successful transaction
          setPendingFunds([]);
        }
      } catch (error) {
        console.error("Error checking receipt:", error);
      }
    };

    // Check immediately and then every 3 seconds
    checkReceipt();
    const interval = setInterval(checkReceipt, 3000);

    return () => clearInterval(interval);
  }, [createFundTxHash, loadFundsData]);

  const handleSupportClick = (project: Project) => {
    setSelectedProject(project);
    setShowDonateDialog(true);
    // Reset form with default amount
    donationForm.reset({ amount: 5 });
  };

  // Add this function to handle donation submission
  const handleDonateSubmit = async (values: { amount: number }) => {
    if (!selectedProject || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      const amountInWei = ethers.utils.parseUnits(values.amount.toString(), 6); // USDC has 6 decimals

      console.log("Donating to fund:", selectedProject.name);
      console.log("Amount:", values.amount, "USDC");

      // Call the USDC transfer function
      createFund({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [selectedProject.address, amountInWei],
      });

      toast.success(
        `Donating ${values.amount} USDC to ${selectedProject.name}`,
      );
      setShowDonateDialog(false);
    } catch (error) {
      console.error("Error donating:", error);
      toast.error("Failed to donate");
    }
  };

  // Add this function to handle preset selection
  const handlePresetSelect = (amount: number) => {
    donationForm.setValue("amount", amount);
  };

  useEffect(() => {
    const load = async () => {
      setIsSDKLoaded(true);
      await sdk.actions.ready();
    };
    if (sdk && !isSDKLoaded) {
      load();
    }
  }, [isSDKLoaded]);

  // Make sure this event listener is properly detecting events
  useEffect(() => {
    if (!isConnected) return;

    const listenToFundEvents = async () => {
      try {
        // Important: Use JsonRpcProvider instead of Web3Provider for event monitoring
        const provider = new ethers.providers.JsonRpcProvider(
          "https://sepolia.base.org",
        );

        const factoryContract = new ethers.Contract(
          FACTORY_ADDRESS,
          FactoryABI.abi,
          provider,
        );

        console.log(
          "FRONTEND: Setting up event listener for RegenThemFundCreated",
        );

        // Add more logging to catch the event
        factoryContract.on(
          "RegenThemFundCreated",
          async (owner, fundAddress, name, goalAmount) => {
            console.log("FRONTEND EVENT DETECTED! Fund created:", {
              owner,
              fundAddress,
              name,
              goalAmount: ethers.utils.formatUnits(goalAmount, 18),
            });

            // Get the full fund data immediately
            const newFundData = await fetchFundData(fundAddress);
            console.log("New fund data fetched:", newFundData);

            if (newFundData) {
              toast.success(`New fund "${name}" was created!`);

              // Update the projects state with the new fund
              setProjects((prev) => {
                // Make sure we don't add duplicates
                const exists = prev.some((p) => p.address === fundAddress);
                if (exists) return prev;
                return [...prev, newFundData];
              });
            }
          },
        );

        return () => {
          console.log("Removing event listeners");
          factoryContract.removeAllListeners("RegenThemFundCreated");
        };
      } catch (error) {
        console.error("Error setting up event listener:", error);
      }
    };

    listenToFundEvents();
  }, [isConnected]);

  // Add this effect to periodically refresh the funds list
  useEffect(() => {
    if (!isConnected) return;

    console.log("Setting up refresh interval");

    // Refresh every 15 seconds
    const intervalId = setInterval(() => {
      console.log("Interval refresh triggered");
      loadFundsData();
    }, 15000);

    return () => {
      console.log("Clearing refresh interval");
      clearInterval(intervalId);
    };
  }, [isConnected, loadFundsData]);

  // Add this at the top of your Demo component:
  useEffect(() => {
    const runDebug = async () => {
      console.log("Running contract debug...");
      const result = await debugContract();
      console.log("Debug result:", result);

      if (result.success && result.funds && result.funds.length > 0) {
        console.log(
          "Funds found but not showing in UI. This suggests a display issue.",
        );
      } else {
        console.log(
          "No funds found in contract. This suggests a contract or connection issue.",
        );
      }
    };

    // Only run this once at component mount, not on every render
    runDebug();
    // Empty dependency array means this only runs once when component mounts
  }, []);

  // Near the top of your component, outside any render logic
  const wsHookResult = useMonitorWebSocket(
    isConnected,
    setProjects,
    (message) => toast.info(message),
  );

  // Then, in your component logic
  const { isWsConnected } = wsHookResult;

  // Update the updateBalances function to properly handle USDC tokens
  const updateBalances = useCallback(async () => {
    if (projects.length === 0) return;

    try {
      const provider = new ethers.providers.JsonRpcProvider(
        "https://sepolia.base.org",
      );

      // Setup USDC contract
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        USDC_ABI,
        provider,
      );

      // Fetch balances for all projects in parallel
      const balancePromises = projects.map(async (project) => {
        // Get USDC balance instead of native ETH
        const usdcBalance = await usdcContract.balanceOf(project.address);
        const usdcBalanceFormatted = Number(
          ethers.utils.formatUnits(usdcBalance, 6),
        ); // USDC uses 6 decimals

        return {
          address: project.address,
          currentBalance: usdcBalanceFormatted,
          totalRaised: usdcBalanceFormatted, // Using same value for now
          progress: Math.min(
            100,
            Math.round((usdcBalanceFormatted / project.goal) * 100),
          ),
        };
      });

      const balanceUpdates = await Promise.all(balancePromises);

      // Check if there are any changes
      let hasChanges = false;
      const updatedProjects = projects.map((project) => {
        const update = balanceUpdates.find(
          (u) => u.address === project.address,
        );
        if (update && project.currentBalance !== update.currentBalance) {
          hasChanges = true;
          console.log(
            `Balance updated for ${project.name}: $${update.currentBalance} (was $${project.currentBalance})`,
          );
          return {
            ...project,
            currentBalance: update.currentBalance,
            totalRaised: update.totalRaised,
            progress: update.progress,
          };
        }
        return project;
      });

      if (hasChanges) {
        setProjects(updatedProjects);
        console.log("Fund balances updated");
      }
    } catch (error) {
      console.error("Error updating balances:", error);
    }
  }, [projects]);

  // Add this effect to refresh balances every 5 seconds
  useEffect(() => {
    if (!isConnected) return;

    // Update immediately
    updateBalances();

    // Then update every 5 seconds
    const intervalId = setInterval(() => {
      updateBalances();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isConnected, updateBalances]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full max-w-[800px] mx-auto py-8 px-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/logo.png"
            alt="RegenThem Logo"
            width={50}
            height={50}
            className="rounded-md mr-2"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
            RegenThem
          </h1>
        </div>

        {/* Add the monitor indicator next to the heading */}
        <div className="flex items-center">
          <Button
            onClick={() =>
              isConnected
                ? disconnect()
                : connect({ connector: config.connectors[0] })
            }
            className="rounded-md px-6 hover:shadow-md transition-all"
          >
            {isConnected ? "Disconnect" : "Connect Wallet"}
          </Button>
        </div>
      </div>

      {/* Rotating ad banner */}
      <div className="overflow-hidden py-2 mb-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-md relative">
        <div
          className="whitespace-nowrap inline-block"
          style={{
            animation: "scroll-x 20s linear infinite",
          }}
        >
          <span className="text-white font-medium px-4">
            🌱 Plant a tree with every donation
          </span>
          <span className="text-white font-medium px-4">
            💚 Every USDC makes a difference
          </span>
          <span className="text-white font-medium px-4">
            🌿 Support regenerative projects today
          </span>
          <span className="text-white font-medium px-4">
            🌱 Plant a tree with every donation
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-x {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      <div className="mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
        <p className="text-md text-gray-700 dark:text-gray-300 leading-relaxed">
          Regular people, real impact. Connect, click, give.
        </p>
        <div className="flex items-center justify-end mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            Don&apos;t have crypto? Fund with your card
          </p>
          <span className="mr-3 text-primary">→</span>
          <FundButton className="bg-primary hover:bg-primary/90 rounded-md py-2 px-4 text-white font-medium transition-colors duration-200" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {projects.map((project, index) => (
            <FundCard
              key={index}
              fund={project}
              onSupportClick={handleSupportClick}
            />
          ))}
        </div>
      )}

      {pendingFunds.map((fund, index) => (
        <div
          key={`pending-${index}`}
          className="rounded-xl border border-gray-200 p-4 bg-white opacity-60"
        >
          <div className="animate-pulse">
            <div className="bg-gray-200 h-48 rounded-lg mb-3"></div>
            <h3 className="font-semibold text-lg mb-1">
              {fund.name} (Creating...)
            </h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2 h-10">
              {fund.description}
            </p>
            <div className="h-2.5 bg-gray-200 rounded-full mb-2"></div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">$0 raised</p>
              <p className="text-xs font-medium text-green-600">Pending...</p>
            </div>
          </div>
        </div>
      ))}

      {/* Fixed Dialog Button - always visible at bottom right */}
      <div className="fixed bottom-6 right-6 z-50">
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button
              className="h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center"
              aria-label="Create new project"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Start a new regenerative project to help the planet and your
                community.
              </DialogDescription>
            </DialogHeader>
            <Form {...projectForm}>
              <form
                onSubmit={projectForm.handleSubmit(onSubmitProject)}
                className="space-y-4"
              >
                <FormField
                  control={projectForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fund Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter fund name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter image URL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter goal amount"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white"
                  disabled={isCreatingFund}
                >
                  {isCreatingFund ? "Creating..." : "Publish"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Move the WebSocket status indicator to a fixed position in the corner */}
      <div className="fixed bottom-6 left-6 flex items-center bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full shadow-md z-40 opacity-70 hover:opacity-100 transition-opacity">
        <div
          className={`w-2 h-2 rounded-full mr-2 ${isWsConnected ? "bg-green-500" : "bg-red-500"}`}
        ></div>
        <span className="text-xs text-gray-500">
          {isWsConnected ? "Monitor connected" : "Monitor offline"}
        </span>
      </div>

      {/* Donation Dialog */}
      <Dialog open={showDonateDialog} onOpenChange={setShowDonateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Support this Fund</DialogTitle>
            <DialogDescription>
              {selectedProject ? (
                <span>
                  Donate USDC to support <strong>{selectedProject.name}</strong>
                </span>
              ) : (
                "Choose an amount to donate"
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...donationForm}>
            <form
              onSubmit={donationForm.handleSubmit(handleDonateSubmit)}
              className="space-y-6"
            >
              {/* Preset amounts */}
              <div className="space-y-3">
                <FormLabel>Choose an amount</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 25].map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant={
                        donationForm.getValues("amount") === amount
                          ? "default"
                          : "outline"
                      }
                      onClick={() => handlePresetSelect(amount)}
                      className="flex-1"
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <FormField
                control={donationForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Amount (USDC)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          className="pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDonateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  Donate
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
