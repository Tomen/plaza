import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import DMConversationABI from "../contracts/DMConversation.json";
import {
  createReadContract,
  createWriteContract,
  type Provider,
  type Signer,
} from "../utils/contracts";
import {
  deriveSharedSecret,
  encrypt,
  decrypt,
  hexToBytes,
} from "../utils/crypto";
import {
  getCurrentPrivateKeyBytes,
  getAllPrivateKeys,
} from "../utils/sessionKeys";

interface UseDMConversationProps {
  conversationAddress: string | null;
  provider: Provider | null;
  userAddress: string | null;
  signer?: Signer | null;
  theirPublicKey: string | null; // Other participant's session public key
  enabled?: boolean;
  pollingInterval?: number; // ms
}

export interface DecryptedMessage {
  index: number;
  senderOwner: string;
  senderAddress: string;
  content: string;
  timestamp: number;
  isFromMe: boolean;
  decryptionFailed: boolean;
}

interface UseDMConversationReturn {
  // State
  messages: DecryptedMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;

  // Conversation info
  participant1: string | null;
  participant2: string | null;
  messageCount: number;

  // Actions
  sendMessage: (plaintext: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useDMConversation({
  conversationAddress,
  provider,
  userAddress,
  signer,
  theirPublicKey,
  enabled = true,
  pollingInterval = 5000,
}: UseDMConversationProps): UseDMConversationReturn {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participant1, setParticipant1] = useState<string | null>(null);
  const [participant2, setParticipant2] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);

  const lastMessageCount = useRef(0);

  const getReadContract = useCallback(() => {
    return createReadContract(
      conversationAddress,
      DMConversationABI.abi,
      provider
    );
  }, [conversationAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(
      conversationAddress,
      DMConversationABI.abi,
      provider,
      signer ?? null
    );
  }, [conversationAddress, provider, signer]);

  // Decrypt a single message trying all available keys
  const decryptMessage = useCallback(
    async (
      encryptedContent: string,
      senderOwner: string
    ): Promise<{ content: string; failed: boolean }> => {
      if (!theirPublicKey) {
        return { content: "[No session key available]", failed: true };
      }

      // If message is from us, we encrypted with their public key
      // If message is from them, they encrypted with our public key
      const isFromMe = senderOwner === userAddress;

      try {
        let sharedSecret: Uint8Array;

        if (isFromMe) {
          // We sent this, so we encrypted using their public key
          const myPrivateKey = getCurrentPrivateKeyBytes();
          sharedSecret = await deriveSharedSecret(
            myPrivateKey,
            hexToBytes(theirPublicKey)
          );
        } else {
          // They sent this, so they encrypted using our public key
          // Try all our keys (current, pending, old) to decrypt
          const allPrivateKeys = getAllPrivateKeys();
          let decrypted = false;
          let plaintext = "";

          for (const privateKey of allPrivateKeys) {
            try {
              sharedSecret = await deriveSharedSecret(
                privateKey,
                hexToBytes(theirPublicKey)
              );
              plaintext = await decrypt(sharedSecret, encryptedContent);
              decrypted = true;
              break;
            } catch {
              // Try next key
              continue;
            }
          }

          if (!decrypted) {
            return { content: "[Unable to decrypt]", failed: true };
          }

          return { content: plaintext, failed: false };
        }

        const plaintext = await decrypt(sharedSecret, encryptedContent);
        return { content: plaintext, failed: false };
      } catch (err) {
        console.error("Decryption failed:", err);
        return { content: "[Decryption failed]", failed: true };
      }
    },
    [theirPublicKey, userAddress]
  );

  const loadMessages = useCallback(async () => {
    if (!conversationAddress || !userAddress) {
      setMessages([]);
      return;
    }

    const contract = getReadContract();
    if (!contract) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get conversation info
      const [p1, p2, count] = await contract.getConversationInfo();
      setParticipant1(p1);
      setParticipant2(p2);
      setMessageCount(Number(count));

      // Get all messages
      if (Number(count) === 0) {
        setMessages([]);
        lastMessageCount.current = 0;
        return;
      }

      const rawMessages = await contract.getMessages(0, Number(count));

      // Decrypt all messages
      const decryptedMessages: DecryptedMessage[] = await Promise.all(
        rawMessages.map(
          async (
            msg: {
              senderOwner: string;
              senderAddress: string;
              encryptedContent: string;
              timestamp: bigint;
            },
            index: number
          ) => {
            const { content, failed } = await decryptMessage(
              msg.encryptedContent,
              msg.senderOwner
            );

            return {
              index,
              senderOwner: msg.senderOwner,
              senderAddress: msg.senderAddress,
              content,
              timestamp: Number(msg.timestamp),
              isFromMe: msg.senderOwner === userAddress,
              decryptionFailed: failed,
            };
          }
        )
      );

      setMessages(decryptedMessages);
      lastMessageCount.current = Number(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [
    conversationAddress,
    userAddress,
    getReadContract,
    decryptMessage,
  ]);

  // Initial load
  useEffect(() => {
    if (enabled) {
      loadMessages();
    }
  }, [enabled, conversationAddress, provider, loadMessages]);

  // Polling for new messages
  useEffect(() => {
    if (!enabled || !conversationAddress || pollingInterval <= 0) return;

    const poll = async () => {
      const contract = getReadContract();
      if (!contract) return;

      try {
        const count = await contract.getMessageCount();
        if (Number(count) > lastMessageCount.current) {
          await loadMessages();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    const interval = setInterval(poll, pollingInterval);
    return () => clearInterval(interval);
  }, [
    enabled,
    conversationAddress,
    pollingInterval,
    getReadContract,
    loadMessages,
  ]);

  const sendMessage = useCallback(
    async (plaintext: string) => {
      if (!enabled) throw new Error("Not enabled");
      if (!theirPublicKey) throw new Error("Recipient has no session key");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      setIsSending(true);
      try {
        // Encrypt the message using ECDH shared secret
        const myPrivateKey = getCurrentPrivateKeyBytes();
        const sharedSecret = await deriveSharedSecret(
          myPrivateKey,
          hexToBytes(theirPublicKey)
        );

        const encryptedContent = await encrypt(sharedSecret, plaintext);

        // Post encrypted message to the contract
        const tx = await contract.postMessage(ethers.getBytes(encryptedContent));
        await tx.wait();

        // Refresh messages
        await loadMessages();
      } finally {
        setIsSending(false);
      }
    },
    [enabled, theirPublicKey, getWriteContract, loadMessages]
  );

  return {
    messages,
    isLoading,
    isSending,
    error,
    participant1,
    participant2,
    messageCount,
    sendMessage,
    refresh: loadMessages,
  };
}
