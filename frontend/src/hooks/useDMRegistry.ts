import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import DMRegistryABI from "../contracts/DMRegistry.json";
import {
  createReadContract,
  createWriteContract,
  type Provider,
  type Signer,
} from "../utils/contracts";

interface UseDMRegistryProps {
  registryAddress: string | null;
  provider: Provider | null;
  userAddress: string | null;
  signer?: Signer | null;
  enabled?: boolean;
}

export interface ConversationInfo {
  address: string;
  participant1: string;
  participant2: string;
  otherParticipant: string;
  messageCount: number;
}

interface UseDMRegistryReturn {
  // State
  conversations: ConversationInfo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  createConversation: (otherUser: string) => Promise<string>;
  getConversation: (user1: string, user2: string) => Promise<string>;
  conversationExists: (user1: string, user2: string) => Promise<boolean>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useDMRegistry({
  registryAddress,
  provider,
  userAddress,
  signer,
  enabled = true,
}: UseDMRegistryProps): UseDMRegistryReturn {
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(registryAddress, DMRegistryABI.abi, provider);
  }, [registryAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(
      registryAddress,
      DMRegistryABI.abi,
      provider,
      signer ?? null
    );
  }, [registryAddress, provider, signer]);

  const loadConversations = useCallback(async () => {
    if (!userAddress) {
      setConversations([]);
      return;
    }

    const contract = getReadContract();
    if (!contract) return;

    try {
      setIsLoading(true);
      setError(null);

      const convAddresses: string[] = await contract.getConversations(
        userAddress
      );

      // Load info for each conversation
      const convInfos: ConversationInfo[] = await Promise.all(
        convAddresses.map(async (addr) => {
          // Get the DMConversation contract to read participant info
          const convContract = new ethers.Contract(
            addr,
            [
              "function getConversationInfo() view returns (address, address, uint256)",
            ],
            provider!
          );

          const [p1, p2, msgCount] = await convContract.getConversationInfo();
          const otherParticipant = p1 === userAddress ? p2 : p1;

          return {
            address: addr,
            participant1: p1,
            participant2: p2,
            otherParticipant,
            messageCount: Number(msgCount),
          };
        })
      );

      setConversations(convInfos);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversations"
      );
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, getReadContract, provider]);

  useEffect(() => {
    if (enabled) {
      loadConversations();
    }
  }, [enabled, userAddress, registryAddress, provider, loadConversations]);

  const createConversation = useCallback(
    async (otherUser: string): Promise<string> => {
      if (!enabled) throw new Error("Not enabled");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.createConversation(otherUser);
      const receipt = await tx.wait();

      // Find the ConversationCreated event
      const event = receipt.logs.find(
        (log: ethers.Log) =>
          log.topics[0] ===
          ethers.id("ConversationCreated(address,address,address)")
      );

      if (!event) {
        throw new Error("ConversationCreated event not found");
      }

      // Decode the event - first topic after signature is the conversation address
      const iface = new ethers.Interface(DMRegistryABI.abi);
      const decoded = iface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });

      const conversationAddress = decoded?.args[0] as string;

      // Refresh conversations list
      await loadConversations();

      return conversationAddress;
    },
    [enabled, getWriteContract, loadConversations]
  );

  const getConversation = useCallback(
    async (user1: string, user2: string): Promise<string> => {
      const contract = getReadContract();
      if (!contract) return ethers.ZeroAddress;

      return contract.getConversation(user1, user2);
    },
    [getReadContract]
  );

  const conversationExists = useCallback(
    async (user1: string, user2: string): Promise<boolean> => {
      const contract = getReadContract();
      if (!contract) return false;

      return contract.conversationExists(user1, user2);
    },
    [getReadContract]
  );

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    getConversation,
    conversationExists,
    refresh: loadConversations,
  };
}
