import { useState, useEffect } from 'react';

interface NetworkDeployment {
  network: string;
  chainId: number;
  rpcUrl: string;
  userRegistry: string;
  channelRegistry: string;
  dmRegistry: string;
  channels: {
    general: string;
  };
  deployedAt: string;
}

interface Deployments {
  [networkName: string]: NetworkDeployment;
}

interface UseDeploymentsReturn {
  deployments: Deployments | null;
  currentNetwork: NetworkDeployment | null;
  isLoading: boolean;
  error: string | null;
}

// Default network to use
const DEFAULT_NETWORK = 'polkadot-asset-hub-testnet';

export function useDeployments(): UseDeploymentsReturn {
  const [deployments, setDeployments] = useState<Deployments | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDeployments = async () => {
      try {
        // Try to fetch deployments.json from public folder
        const response = await fetch('/deployments.json');
        if (!response.ok) {
          throw new Error(`Failed to load deployments: ${response.status}`);
        }
        const data = await response.json();
        setDeployments(data);
      } catch (err) {
        console.warn('Could not load deployments.json:', err);
        setError(err instanceof Error ? err.message : 'Failed to load deployments');
      } finally {
        setIsLoading(false);
      }
    };

    loadDeployments();
  }, []);

  // Get the current network deployment
  const currentNetwork = deployments?.[DEFAULT_NETWORK] || null;

  return {
    deployments,
    currentNetwork,
    isLoading,
    error,
  };
}
