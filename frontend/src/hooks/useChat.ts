import { useState, useEffect, useCallback } from 'react';
import { Contract } from 'ethers';
import type { WalletState } from './useWallet';
import type { Message, FormattedMessage } from '../types/contract';
import OnChainChatArtifact from '../contracts/OnChainChat.json';

export function useChat(walletState: WalletState, contractAddress: string | null) {
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback(() => {
    if (!walletState.provider || !contractAddress) return null;

    const signerOrProvider = walletState.signer || walletState.provider;
    return new Contract(contractAddress, OnChainChatArtifact.abi, signerOrProvider);
  }, [walletState.provider, walletState.signer, contractAddress]);

  const formatMessage = (msg: Message): FormattedMessage => {
    const timestamp = Number(msg.timestamp);
    const date = new Date(timestamp * 1000);

    return {
      sender: msg.sender,
      content: msg.content,
      timestamp,
      formattedTime: date.toLocaleString(),
    };
  };

  const loadMessages = useCallback(async () => {
    const contract = getContract();
    if (!contract) return;

    setIsLoading(true);
    setError(null);

    try {
      const count = await contract.getMessageCount();
      const messageCount = Number(count);

      if (messageCount === 0) {
        setMessages([]);
        return;
      }

      const fetchCount = Math.min(messageCount, 50);
      const rawMessages: Message[] = await contract.getLatestMessages(fetchCount);

      const formatted = rawMessages.map(formatMessage);
      setMessages(formatted);
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [getContract]);

  const postMessage = async (content: string): Promise<boolean> => {
    if (!walletState.signer) {
      setError('Please connect your wallet first');
      return false;
    }

    const contract = getContract();
    if (!contract) return false;

    setIsSending(true);
    setError(null);

    try {
      const tx = await contract.postMessage(content);
      await tx.wait();

      await loadMessages();
      return true;
    } catch (err: any) {
      console.error('Error posting message:', err);
      setError(err.message || 'Failed to post message');
      return false;
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (walletState.provider && contractAddress) {
      loadMessages();

      const contract = getContract();
      if (contract) {
        const filter = contract.filters.MessagePosted();
        contract.on(filter, () => {
          loadMessages();
        });

        return () => {
          contract.off(filter, loadMessages);
        };
      }
    }
  }, [walletState.provider, contractAddress, loadMessages, getContract]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    postMessage,
    refresh: loadMessages,
  };
}
