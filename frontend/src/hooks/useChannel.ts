import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import type { Message, FormattedMessage, ChannelInfo, PostingMode } from "../types/contracts";
import ChatChannelABI from "../contracts/ChatChannel.json";
import { formatTimestamp } from "../utils/formatters";

interface UseChannelProps {
  channelAddress: string | null;
  provider: ethers.BrowserProvider | null;
  appWallet?: ethers.Wallet | null;
  getDisplayName?: (address: string) => Promise<string>;
}

interface UseChannelReturn {
  // State
  messages: FormattedMessage[];
  channelInfo: ChannelInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  postMessage: (content: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  loadChannelInfo: () => Promise<void>;
}

export function useChannel({
  channelAddress,
  provider,
  appWallet,
  getDisplayName,
}: UseChannelProps): UseChannelReturn {
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  const getContract = useCallback(
    (signer?: ethers.Wallet | ethers.Signer) => {
      if (!channelAddress || !provider) return null;

      if (signer) {
        const connectedSigner = signer instanceof ethers.Wallet
          ? signer.connect(provider)
          : signer;
        return new ethers.Contract(channelAddress, ChatChannelABI.abi, connectedSigner);
      }

      return new ethers.Contract(channelAddress, ChatChannelABI.abi, provider);
    },
    [channelAddress, provider]
  );

  const loadChannelInfo = useCallback(async () => {
    const contract = getContract();
    if (!contract) return;

    try {
      const info = await contract.getChannelInfo();
      setChannelInfo({
        name: info._name,
        description: info._description,
        motd: info._motd,
        owner: info._owner,
        postingMode: Number(info._postingMode) as PostingMode,
        messageCount: info._messageCount,
      });
    } catch (err) {
      console.error("Failed to load channel info:", err);
    }
  }, [getContract]);

  const loadMessages = useCallback(async () => {
    const contract = getContract();
    if (!contract) {
      setMessages([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const count = await contract.getMessageCount();
      if (count === 0n) {
        setMessages([]);
        return;
      }

      // Load latest 50 messages
      const limit = count > 50n ? 50n : count;
      const rawMessages = await contract.getLatestMessages(limit);

      // Format messages and optionally resolve display names
      const formatted: FormattedMessage[] = await Promise.all(
        rawMessages.map(async (msg: Message) => {
          let displayName: string | undefined;
          if (getDisplayName) {
            try {
              displayName = await getDisplayName(msg.profileOwner);
            } catch {
              displayName = undefined;
            }
          }

          return {
            profileOwner: msg.profileOwner,
            sender: msg.sender,
            content: msg.content,
            timestamp: Number(msg.timestamp),
            formattedTime: formatTimestamp(Number(msg.timestamp)),
            displayName,
          };
        })
      );

      setMessages(formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [getContract, getDisplayName]);

  const postMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) {
        throw new Error("Message cannot be empty");
      }

      // Prefer app wallet for gasless UX, fallback to browser signer
      let contract;
      if (appWallet && provider) {
        contract = getContract(appWallet);
      } else if (provider) {
        const signer = await provider.getSigner();
        contract = getContract(signer);
      }

      if (!contract) {
        throw new Error("Contract not available");
      }

      try {
        const tx = await contract.postMessage(content);
        await tx.wait();
        await loadMessages();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to post message");
      }
    },
    [getContract, appWallet, provider, loadMessages]
  );

  // Load messages and channel info when channel changes
  useEffect(() => {
    if (channelAddress && provider) {
      loadMessages();
      loadChannelInfo();
    } else {
      setMessages([]);
      setChannelInfo(null);
    }
  }, [channelAddress, provider, loadMessages, loadChannelInfo]);

  // Poll for new messages
  useEffect(() => {
    if (!channelAddress || !provider) return;

    // Poll every 5 seconds
    pollIntervalRef.current = window.setInterval(() => {
      loadMessages();
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [channelAddress, provider, loadMessages]);

  return {
    messages,
    channelInfo,
    isLoading,
    error,
    postMessage,
    loadMessages,
    loadChannelInfo,
  };
}
