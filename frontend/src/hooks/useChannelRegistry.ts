import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import type { RegisteredChannel } from "../types/contracts";
import { PostingMode } from "../types/contracts";
import ChannelRegistryABI from "../contracts/ChannelRegistry.json";
import { createReadContract, createWriteContract, type Provider, type Signer } from "../utils/contracts";

interface UseChannelRegistryProps {
  registryAddress: string | null;
  provider: Provider | null;
  signer?: Signer | null;
  enabled?: boolean;
}

interface UseChannelRegistryReturn {
  // State
  channels: RegisteredChannel[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadChannels: () => Promise<void>;
  createChannel: (
    name: string,
    description: string,
    postingMode: PostingMode
  ) => Promise<{ channelAddress: string; registryIndex: bigint }>;
  registerChannel: (channelAddress: string) => Promise<bigint>;
  getChannelCount: () => Promise<bigint>;
  getChannel: (index: number) => Promise<RegisteredChannel>;
  getChannelsByCreator: (creator: string) => Promise<bigint[]>;
  getUserRegistryAddress: () => Promise<string>;
}

export function useChannelRegistry({
  registryAddress,
  provider,
  signer,
  enabled = true,
}: UseChannelRegistryProps): UseChannelRegistryReturn {
  const [channels, setChannels] = useState<RegisteredChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(registryAddress, ChannelRegistryABI.abi, provider);
  }, [registryAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(registryAddress, ChannelRegistryABI.abi, provider, signer ?? null);
  }, [registryAddress, provider, signer]);

  const loadChannels = useCallback(async () => {
    const contract = getReadContract();
    if (!contract) {
      setChannels([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const allChannels = await contract.getAllChannels();
      setChannels(
        allChannels.map((c: { channelAddress: string; registeredBy: string; registeredAt: bigint }) => ({
          channelAddress: c.channelAddress,
          registeredBy: c.registeredBy,
          registeredAt: c.registeredAt,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract]);

  useEffect(() => {
    if (enabled && registryAddress && provider) {
      loadChannels();
    } else {
      setChannels([]);
    }
  }, [enabled, registryAddress, provider, loadChannels]);

  const createChannel = useCallback(
    async (name: string, description: string, postingMode: PostingMode) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.createChannel(name, description, postingMode);
      const receipt = await tx.wait();

      // Parse the ChannelCreated event to get the channel address
      const iface = new ethers.Interface(ChannelRegistryABI.abi);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "ChannelCreated") {
            await loadChannels();
            return {
              channelAddress: parsed.args.channelAddress,
              registryIndex: parsed.args.registryIndex,
            };
          }
        } catch {
          // Not a matching log
        }
      }

      throw new Error("Failed to parse channel creation event");
    },
    [enabled, getWriteContract, loadChannels]
  );

  const registerChannel = useCallback(
    async (channelAddress: string): Promise<bigint> => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.registerChannel(channelAddress);
      const receipt = await tx.wait();

      // Parse the ChannelRegistered event
      const iface = new ethers.Interface(ChannelRegistryABI.abi);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === "ChannelRegistered") {
            await loadChannels();
            return parsed.args.index;
          }
        } catch {
          // Not a matching log
        }
      }

      throw new Error("Failed to parse registration event");
    },
    [enabled, getWriteContract, loadChannels]
  );

  const getChannelCount = useCallback(async (): Promise<bigint> => {
    const contract = getReadContract();
    if (!contract) return 0n;

    return contract.getChannelCount();
  }, [getReadContract]);

  const getChannel = useCallback(
    async (index: number): Promise<RegisteredChannel> => {
      const contract = getReadContract();
      if (!contract) throw new Error("Contract not available");

      const c = await contract.getChannel(index);
      return {
        channelAddress: c.channelAddress,
        registeredBy: c.registeredBy,
        registeredAt: c.registeredAt,
      };
    },
    [getReadContract]
  );

  const getChannelsByCreator = useCallback(
    async (creator: string): Promise<bigint[]> => {
      const contract = getReadContract();
      if (!contract) return [];

      return contract.getChannelsByCreator(creator);
    },
    [getReadContract]
  );

  const getUserRegistryAddress = useCallback(async (): Promise<string> => {
    const contract = getReadContract();
    if (!contract) throw new Error("Contract not available");

    return contract.userRegistry();
  }, [getReadContract]);

  return {
    channels,
    isLoading,
    error,
    loadChannels,
    createChannel,
    registerChannel,
    getChannelCount,
    getChannel,
    getChannelsByCreator,
    getUserRegistryAddress,
  };
}
