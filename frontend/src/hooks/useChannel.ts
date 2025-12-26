import { useState, useCallback, useEffect, useRef } from "react";
import type { Message, FormattedMessage, ChannelInfo, PostingMode } from "../types/contracts";
import ChatChannelABI from "../contracts/ChatChannel.json";
import { formatTimestamp } from "../utils/formatters";
import { createReadContract, createWriteContract, type Provider, type Signer } from "../utils/contracts";

interface UseChannelProps {
  channelAddress: string | null;
  provider: Provider | null;
  appWallet?: Signer | null;
  getDisplayName?: (address: string) => Promise<string>;
  enabled?: boolean;
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
  enabled = true,
}: UseChannelProps): UseChannelReturn {
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(channelAddress, ChatChannelABI.abi, provider);
  }, [channelAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(channelAddress, ChatChannelABI.abi, provider, appWallet ?? null);
  }, [channelAddress, provider, appWallet]);

  const loadChannelInfo = useCallback(async () => {
    const contract = getReadContract();
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
  }, [getReadContract]);

  const loadMessages = useCallback(async () => {
    const contract = getReadContract();
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
  }, [getReadContract, getDisplayName]);

  const postMessage = useCallback(
    async (content: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!content.trim()) {
        throw new Error("Message cannot be empty");
      }

      const contract = await getWriteContract();
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
    [enabled, getWriteContract, loadMessages]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelAddress, provider]);

  // Poll for new messages every 15 seconds
  useEffect(() => {
    if (!channelAddress || !provider) return;

    pollIntervalRef.current = window.setInterval(() => {
      loadMessages();
    }, 15000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelAddress, provider]);

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
