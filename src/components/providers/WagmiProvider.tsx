import { createConfig, http, WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { frameConnector } from '../../lib/connector';
import { OnchainKitProvider } from '@coinbase/onchainkit';

export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [frameConnector()],
});

const queryClient = new QueryClient();

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <OnchainKitProvider
        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
        projectId={process.env.NEXT_PUBLIC_CDP_PROJECT_ID} 
        chain={base}
      >
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </OnchainKitProvider>
    </WagmiProvider>
  );
}