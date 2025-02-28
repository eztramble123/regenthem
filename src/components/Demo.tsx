import { useEffect, useCallback, useState } from 'react';
import sdk, { type Context } from '@farcaster/frame-sdk';
import { FundButton } from '@coinbase/onchainkit/fund';
import { Plus } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from "sonner";

import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
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

// Add this interface near the top of the file, after imports
interface Project {
  name: string;
  description: string;
  image: string;
  goal: number;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const { address, isConnected } = useAccount();
  const {
    sendTransaction,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

  const {
    signMessage,
    error: signError,
    isError: isSignError,
    isPending: isSignPending,
  } = useSignMessage();

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData();

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

  const onSubmitProject = (values: Project) => {
    setProjects((prevProjects) => [...prevProjects, values]);
    projectForm.reset();
    toast(`Successfully created the project: ${values.name}`);
  };

  const handleSupportClick = (project: Project) => {
    setSelectedProject(project);
  };

  const handleDonate = (amount: number) => {
    console.log(`Donating ${amount} USDC to ${selectedProject?.name}`);
    // Implement donation logic here
    donationForm.reset();
    toast(`Donated ${amount} USDC to ${selectedProject?.name}`);
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

  const openUrl = useCallback(() => {
    sdk.actions.openUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  }, []);

  const close = useCallback(() => {
    sdk.actions.close();
  }, []);

  const sendTx = useCallback(() => {
    sendTransaction(
      {
        to: '0x4bBFD120d9f352A0BEd7a014bd67913a2007a878',
        data: '0x9846cd9efc000023c0',
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash);
        },
      }
    );
  }, [sendTransaction]);

  const sign = useCallback(() => {
    signMessage({ message: 'Hello from Frames v2!' });
  }, [signMessage]);

  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: 'RegenThem',
        version: '1',
        chainId: 8453,
      },
      types: {
        Message: [{ name: 'content', type: 'string' }],
      },
      message: {
        content: 'Hello from Frames v2!',
      },
      primaryType: 'Message',
    });
  }, [signTypedData]);

  const toggleContext = useCallback(() => {
    setIsContextOpen((prev) => !prev);
  }, []);

  const renderError = (error: Error | null) => {
    if (!error) return null;
    return <div className="text-red-500 text-xs mt-1">{error.message}</div>;
  };

  const startGame = () => {
    setIsPlaying(true);
    // Initialize game logic here
  };

  const endGame = (won: boolean) => {
    setIsPlaying(false);
    if (won) {
      setScore(score + 1);
    }
  };

  const topUpWallet = () => {
    // Integrate Coinbase Onramp here
    console.log('Top up wallet using Coinbase Onramp');
  };

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

      <div className="grid grid-cols-2 grid-rows-4 gap-6 mb-8">
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
              value={0}
              className="h-2.5 mb-2 bg-gray-200 dark:bg-gray-700"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                $0 raised
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
                <Button type="submit" className="bg-green-500 hover:bg-green-600 text-white">Publish</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}