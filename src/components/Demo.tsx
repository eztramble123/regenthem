import { useEffect, useCallback, useState } from "react";
import sdk, { type Context } from "@farcaster/frame-sdk";
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
import RegenThemFundABI from "../contracts/RegenThemFund.json";

// Import the fund fetcher utilities
import { fetchFundData, debugContract } from "../utils/fundDataFetcher";
import FundCard from "./FundCard";

// Import the useMonitorWebSocket hook
import { useMonitorWebSocket } from "../hooks/useMonitorWebSocket";

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

console.log("Factory address:", FACTORY_ADDRESS);
console.log("Has ABI:", !!FactoryABI.abi);

export default function Demo() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFunds, setPendingFunds] = useState<
    { name: string; description: string }[]
  >([]);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Read all funds from factory contract
  const { data: fundAddresses } = useContractRead({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: FactoryABI.abi,
    functionName: "getRegenThemFundContracts",
    chainId: config.chains[0].id,
  }) as { data: string[] | undefined };

  // Replace the deprecated hook
  const {
    writeContract: createFund,
    isPending: isCreatingFund,
    data: createFundTxHash,
  } = useWriteContract();

  // Track transaction status if needed
  const { isLoading: isConfirmingFund } = useWaitForTransactionReceipt({
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

  // Form for donating to a project
  const donationForm = useForm({
    defaultValues: {
      customAmount: 0,
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

  // Update your submit function to use the new pattern
  const onSubmitProject = async (values: {
    goal: { toString: () => string };
    name: unknown;
    description: unknown;
  }) => {
    // Check if on the correct network
    if (chainId !== config.chains[0].id) {
      toast.info("Switching to Base Sepolia testnet...");
      try {
        await switchChain({ chainId: config.chains[0].id });
        // Return early and let the user try again after network switch
        return;
      } catch (error) {
        console.error("Failed to switch network:", error);
        toast.error("Please switch to Base Sepolia testnet manually");
        return;
      }
    }

    try {
      const goalInWei = ethers.utils.parseUnits(values.goal.toString(), 18);

      console.log("Creating fund with params:", {
        address: FACTORY_ADDRESS,
        name: values.name,
        description: values.description,
        goalInWei: goalInWei.toString(),
      });

      // Call the contract to create a fund
      createFund({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FactoryABI.abi,
        functionName: "createRegenThemFund",
        args: [values.name, values.description, goalInWei],
      });

      // Add this pending fund to show it's in progress
      setPendingFunds((prev) => [
        ...prev,
        {
          name: values.name as string,
          description: values.description as string,
        },
      ]);

      toast.success("Creating fund... please confirm transaction");

      // Reset form after submission
      projectForm.reset();
    } catch (error) {
      console.error("Error creating fund:", error);
      console.error("Form values:", values);
      console.error("Contract address:", FACTORY_ADDRESS);
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
  }, [createFundTxHash]);

  const handleSupportClick = (project: Project) => {
    setSelectedProject(project);
  };

  // Implement donate functionality
  const handleDonate = async (amount: number) => {
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

    if (!selectedProject || !isConnected) {
      console.error(
        "Donation attempted without connection or project selection:",
        {
          isConnected,
          selectedProject: selectedProject?.address || "none",
        },
      );
      toast.error("Please connect your wallet and select a project");
      return;
    }

    try {
      const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);
      console.log("Donating with params:", {
        projectAddress: selectedProject.address,
        amount,
        amountInWei: amountInWei.toString(),
      });

      // First approve USDC transfer
      const provider = new ethers.providers.Web3Provider(
        window.ethereum as any,
      );
      const signer = provider.getSigner();

      // Assuming the USDC token address is stored somewhere
      const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC address

      // Create USDC contract instance
      const usdcContract = new ethers.Contract(
        usdcAddress,
        [
          "function approve(address spender, uint256 amount) public returns (bool)",
        ],
        signer,
      );

      // Approve the fund contract to spend USDC
      const approveTx = await usdcContract.approve(
        selectedProject.address,
        amountInWei,
      );
      toast.info("Approving USDC transfer...");
      await approveTx.wait();

      // Create fund contract instance
      const fundContract = new ethers.Contract(
        selectedProject.address,
        RegenThemFundABI.abi,
        signer,
      );

      // Call the fund function
      const fundTx = await fundContract.fund(amountInWei);
      toast.info("Processing donation...");
      await fundTx.wait();

      toast.success(
        `Successfully donated ${amount} USDC to ${selectedProject.name}`,
      );

      // Refresh project data
      const updatedProject = await fetchFundData(selectedProject.address);
      if (updatedProject) {
        setProjects((prev) =>
          prev.map((p) =>
            p.address === selectedProject.address ? updatedProject : p,
          ),
        );
      }
    } catch (error) {
      console.error("Error donating:", error);
      console.error("Donation details:", {
        projectAddress: selectedProject.address,
        amount,
        walletAddress: address,
      });
      toast.error("Failed to process donation");
    }

    donationForm.reset();
  };

  useEffect(() => {
    const load = async () => {
      setContext(await sdk.context);
      sdk.actions.ready();
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
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
          async (owner, fundAddress, name, goalAmount, event) => {
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

  // Add this manual fund creation for testing
  const addTestFund = () => {
    const testFund = {
      address: "0x1234567890123456789012345678901234567890",
      name: "Test Fund",
      description: "This is a test fund for debugging",
      image: "https://picsum.photos/seed/test/400/300",
      goal: 1000,
      currentBalance: 250,
      totalRaised: 250,
      progress: 25,
      owner: address || "0x0000000000000000000000000000000000000000",
    };

    setProjects((prev) => [...prev, testFund]);
    console.log("Added test fund to UI");
  };

  // Near the top of your component, outside any render logic
  const wsHookResult = useMonitorWebSocket(
    isConnected,
    setProjects,
    (message) => toast.info(message),
  );

  // Then, in your component logic
  const { isWsConnected } = wsHookResult;

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full max-w-[800px] mx-auto py-8 px-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
          RegenThem
        </h1>

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

          <Button
            onClick={addTestFund}
            className="ml-3 rounded-md px-6 hover:shadow-md transition-all bg-purple-500 text-white"
          >
            Add Test Fund
          </Button>
        </div>
      </div>

      <div className="mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
        <p className="text-md text-gray-700 dark:text-gray-300 leading-relaxed">
          Regular people, real impact. Connect, click, give.
        </p>
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
            Don't have crypto? Fund with your card
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
        <Dialog>
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
    </div>
  );
}
