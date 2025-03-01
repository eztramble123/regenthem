import { useEffect, useCallback, useState } from 'react';
import sdk, { type Context } from '@farcaster/frame-sdk';
import { FundButton } from '@coinbase/onchainkit/fund';
import { Plus } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from "sonner";
import { ethers } from 'ethers';

import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useContractRead,
  useWriteContract,
  useContractReads,
} from 'wagmi';

import { config } from '../components/providers/WagmiProvider';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Import contract ABIs
import FactoryABI from '../contracts/RegenThemFundFactory.json';
import RegenThemFundABI from '../contracts/RegenThemFund.json';

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
  name: z.string().min(2, { message: "Fund Name must be at least 2 characters." }),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }),
  image: z.string().url({ message: "Image must be a valid URL." }),
  goal: z.preprocess((val) => Number(val), z.number().min(1, { message: "Goal amount must be at least 1." })),
});

export default function Demo() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { address, isConnected } = useAccount();

  // Read all funds from factory contract
  const { data: fundAddresses } = useContractRead({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: FactoryABI.abi,
    functionName: 'getRegenThemFundContracts',
  }) as { data: string[] | undefined };

  // Replace the deprecated hook
  const { 
    writeContract: createFund, 
    isPending: isCreatingFund,
    data: createFundTxHash
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
      name: '',
      description: '',
      image: '',
      goal: 1,
    },
  });

  // Form for donating to a project
  const donationForm = useForm({
    defaultValues: {
      customAmount: 0,
    },
  });

  // Load projects from blockchain
  useEffect(() => {
    if (fundAddresses && Array.isArray(fundAddresses) && fundAddresses.length > 0) {
      loadProjectsData(fundAddresses);
    }
  }, [fundAddresses]);

  // Load detailed data for each fund
  const loadProjectsData = async (addresses: string[]) => {
    setIsLoading(true);
    try {
      const projectsData: Project[] = [];
      
      for (const address of addresses) {
        const projectInfo = await fetchProjectData(address);
        if (projectInfo) {
          projectsData.push(projectInfo);
        }
      }
      
      setProjects(projectsData);
    } catch (error) {
      console.error("Error loading projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data for a single project
  const fetchProjectData = async (address: string): Promise<Project | null> => {
    try {
      // Use type assertion to access ethereum
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const contract = new ethers.Contract(address, RegenThemFundABI.abi, provider);
      
      const [name, description, goalAmount, currentBalance, totalRaised, progress, owner] = await Promise.all([
        contract.getName(),
        contract.getDescription(),
        contract.getGoalAmount(),
        contract.getCurrentBalance(),
        contract.getTotalRaised(),
        contract.getProgress(),
        contract.getOwner()
      ]);
      
      // Use a placeholder image based on the fund address (or implementation could store images elsewhere)
      const imageHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(address)).slice(2, 10);
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
        owner
      };
    } catch (error) {
      console.error(`Error fetching data for project ${address}:`, error);
      return null;
    }
  };

  // Update your submit function to use the new pattern
  const onSubmitProject = async (values: { goal: { toString: () => string; }; name: unknown; description: unknown; }) => {
    try {
      const goalInWei = ethers.utils.parseUnits(values.goal.toString(), 18);
      
      createFund({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FactoryABI.abi,
        functionName: 'createRegenThemFund',
        args: [values.name, values.description, goalInWei]
      });
      
      toast.success("Creating new fund");
    } catch (error) {
      console.error("Error creating fund:", error);
      toast.error("Failed to create fund");
    }
  };

  const handleSupportClick = (project: Project) => {
    setSelectedProject(project);
  };

  // Implement donate functionality
  const handleDonate = async (amount: number) => {
    if (!selectedProject || !isConnected) {
      toast.error("Please connect your wallet and select a project");
      return;
    }

    try {
      const amountInWei = ethers.utils.parseUnits(amount.toString(), 18);
      
      // First approve USDC transfer
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      // Assuming the USDC token address is stored somewhere
      const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC address
      
      // Create USDC contract instance
      const usdcContract = new ethers.Contract(
        usdcAddress,
        ["function approve(address spender, uint256 amount) public returns (bool)"], 
        signer
      );
      
      // Approve the fund contract to spend USDC
      const approveTx = await usdcContract.approve(selectedProject.address, amountInWei);
      toast.info("Approving USDC transfer...");
      await approveTx.wait();
      
      // Create fund contract instance
      const fundContract = new ethers.Contract(
        selectedProject.address, 
        RegenThemFundABI.abi, 
        signer
      );
      
      // Call the fund function
      const fundTx = await fundContract.fund(amountInWei);
      toast.info("Processing donation...");
      await fundTx.wait();
      
      toast.success(`Successfully donated ${amount} USDC to ${selectedProject.name}`);
      
      // Refresh project data
      const updatedProject = await fetchProjectData(selectedProject.address);
      if (updatedProject) {
        setProjects(prev => prev.map(p => 
          p.address === selectedProject.address ? updatedProject : p
        ));
      }
      
    } catch (error) {
      console.error("Error donating:", error);
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

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full max-w-[800px] mx-auto py-8 px-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">RegenThem</h1>
        <Button
          onClick={() =>
            isConnected
              ? disconnect()
              : connect({ connector: config.connectors[0] })
          }
          className="rounded-md px-6 hover:shadow-md transition-all"
        >
          {isConnected ? 'Disconnect' : 'Connect Wallet'}
        </Button>
      </div>

      <div className="mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
        <p className="text-md text-gray-700 dark:text-gray-300 leading-relaxed">
          Regular people, real impact.
          Connect, click, give.
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
            <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
              <div className="relative">
                <img
                  src={project.image}
                  alt={project.name}
                  className="w-full h-48 object-cover rounded-lg mb-3"
                />
                <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Active</div>
              </div>
              <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 h-10">
                {project.description}
              </p>
              <Progress
                value={project.progress}
                className="h-2.5 mb-2 bg-gray-200 dark:bg-gray-700"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ${project.currentBalance.toLocaleString()} raised
                </p>
                <p className="text-xs font-medium text-green-600 dark:text-green-400">
                  ${project.goal.toLocaleString()} goal
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button onClick={() => handleSupportClick(project)} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm py-1">Support</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Support {selectedProject?.name}</DialogTitle>
                    <DialogDescription>
                      Choose an amount to donate in USDC.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-around">
                      {[10, 50, 100].map((amount) => (
                        <Button key={amount} onClick={() => handleDonate(amount)} className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2">
                          ${amount}
                        </Button>
                      ))}
                    </div>
                    <Form {...donationForm}>
                      <FormField
                        control={donationForm.control}
                        name="customAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Custom Amount</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Enter custom amount" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button onClick={() => handleDonate(donationForm.getValues('customAmount'))} className="w-full bg-green-500 hover:bg-green-600 text-white">Donate</Button>
                    </Form>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ))}
        </div>
      )}

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
                Start a new regenerative project to help the planet and your community.
              </DialogDescription>
            </DialogHeader>
            <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit(onSubmitProject)} className="space-y-4">
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
                        <Input type="number" placeholder="Enter goal amount" {...field} />
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
                  {isCreatingFund ? 'Creating...' : 'Publish'}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}