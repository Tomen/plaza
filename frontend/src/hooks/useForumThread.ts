import { useState, useCallback, useEffect, useRef } from "react";
import type { ForumThread } from "../types/contracts";
import ForumThreadABI from "../contracts/ForumThread.json";
import {
  createReadContract,
  createWriteContract,
  type Provider,
  type Signer,
} from "../utils/contracts";

interface UseForumThreadProps {
  forumThreadAddress: string | null;
  provider: Provider | null;
  signer?: Signer | null;
  getDisplayName?: (address: string) => Promise<string>;
  userRegistryAddress?: string | null;
  enabled?: boolean;
}

interface UseForumThreadReturn {
  // State
  threads: ForumThread[];
  isLoading: boolean;
  error: string | null;
  threadCount: number;

  // Actions
  createThread: (
    title: string,
    content: string,
    tags: string[]
  ) => Promise<number>;
  editThread: (threadIndex: number, newContent: string) => Promise<void>;
  deleteThread: (threadIndex: number) => Promise<void>;
  refresh: () => Promise<void>;

  // Single thread loading
  getThread: (threadIndex: number) => Promise<ForumThread | null>;

  // Author loading
  loadByAuthor: (author: string, count?: number) => Promise<ForumThread[]>;
}

// Raw thread from contract
interface RawThread {
  author: string;
  sender: string;
  title: string;
  content: string;
  timestamp: bigint;
  editedAt: bigint;
  isDeleted: boolean;
  tags: string[];
}

export function useForumThread({
  forumThreadAddress,
  provider,
  signer,
  getDisplayName,
  userRegistryAddress,
  enabled = true,
}: UseForumThreadProps): UseForumThreadReturn {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [threadCount, setThreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);
  const hasAttemptedDisplayNameFetch = useRef(false);

  const getReadContract = useCallback(() => {
    return createReadContract(forumThreadAddress, ForumThreadABI.abi, provider);
  }, [forumThreadAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(
      forumThreadAddress,
      ForumThreadABI.abi,
      provider,
      signer ?? null
    );
  }, [forumThreadAddress, provider, signer]);

  const formatThread = useCallback(
    async (raw: RawThread, index: number): Promise<ForumThread> => {
      let displayName: string | undefined;
      if (getDisplayName) {
        try {
          displayName = await getDisplayName(raw.author);
        } catch {
          displayName = undefined;
        }
      }

      return {
        index,
        author: raw.author,
        sender: raw.sender,
        title: raw.title,
        content: raw.content,
        timestamp: Number(raw.timestamp),
        editedAt: raw.editedAt > 0n ? Number(raw.editedAt) : null,
        isDeleted: raw.isDeleted,
        tags: raw.tags,
        displayName,
      };
    },
    [getDisplayName, userRegistryAddress]
  );

  const loadThreads = useCallback(async () => {
    const contract = getReadContract();
    if (!contract) {
      setThreads([]);
      setThreadCount(0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get total thread count
      const count = await contract.getThreadCount();
      setThreadCount(Number(count));

      if (count === 0n) {
        setThreads([]);
        return;
      }

      // Load all latest threads
      const limit = count > 50n ? 50n : count;
      const [rawThreads, indices] = await contract.getLatestThreads(limit);

      // Format threads with display names
      const formatted: ForumThread[] = await Promise.all(
        rawThreads.map((raw: RawThread, i: number) =>
          formatThread(raw, Number(indices[i]))
        )
      );

      // Filter out deleted threads
      const visible = formatted.filter((t) => !t.isDeleted);
      setThreads(visible);
    } catch (err) {
      console.error("Failed to load threads:", err);
      setError(err instanceof Error ? err.message : "Failed to load threads");
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract, formatThread]);

  const getThread = useCallback(
    async (threadIndex: number): Promise<ForumThread | null> => {
      const contract = getReadContract();
      if (!contract) return null;

      try {
        const raw = await contract.getThread(threadIndex);
        return formatThread(raw, threadIndex);
      } catch (err) {
        console.error("Failed to get thread:", err);
        return null;
      }
    },
    [getReadContract, formatThread]
  );

  const loadByAuthor = useCallback(
    async (author: string, count = 50): Promise<ForumThread[]> => {
      const contract = getReadContract();
      if (!contract) return [];

      try {
        const [rawThreads, indices] = await contract.getLatestThreadsByAuthor(
          author,
          count
        );
        const formatted = await Promise.all(
          rawThreads.map((raw: RawThread, i: number) =>
            formatThread(raw, Number(indices[i]))
          )
        );
        return formatted.filter((t) => !t.isDeleted);
      } catch (err) {
        console.error("Failed to load threads by author:", err);
        return [];
      }
    },
    [getReadContract, formatThread]
  );

  const createThread = useCallback(
    async (
      title: string,
      content: string,
      tags: string[]
    ): Promise<number> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!title.trim()) throw new Error("Thread title cannot be empty");
      if (!content.trim()) throw new Error("Thread content cannot be empty");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.createThread(title, content, tags);
        const receipt = await tx.wait();

        // Extract thread index from event
        const event = receipt.logs.find(
          (log: { topics: readonly string[]; data: string }) => {
            try {
              const parsed = contract.interface.parseLog(log);
              return parsed?.name === "ThreadCreated";
            } catch {
              return false;
            }
          }
        );

        let threadIndex = 0;
        if (event) {
          const parsed = contract.interface.parseLog(event);
          threadIndex = Number(parsed?.args?.threadIndex ?? 0);
        }

        await loadThreads();
        return threadIndex;
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to create thread");
      }
    },
    [enabled, getWriteContract, loadThreads]
  );

  const editThread = useCallback(
    async (threadIndex: number, newContent: string): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!newContent.trim()) throw new Error("Thread content cannot be empty");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.editThread(threadIndex, newContent);
        await tx.wait();
        await loadThreads();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to edit thread");
      }
    },
    [enabled, getWriteContract, loadThreads]
  );

  const deleteThread = useCallback(
    async (threadIndex: number): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.deleteThread(threadIndex);
        await tx.wait();
        await loadThreads();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to delete thread");
      }
    },
    [enabled, getWriteContract, loadThreads]
  );

  // Load threads on mount
  useEffect(() => {
    if (forumThreadAddress && provider) {
      loadThreads();
    } else {
      setThreads([]);
      setThreadCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forumThreadAddress, provider]);

  // Reset the display name fetch flag when userRegistryAddress changes
  useEffect(() => {
    hasAttemptedDisplayNameFetch.current = false;
  }, [userRegistryAddress]);

  // Re-fetch display names when getDisplayName becomes available
  // This triggers when userRegistryAddress changes (which recreates getDisplayName)
  useEffect(() => {
    // Only re-fetch if we have threads and getDisplayName is available
    if (!forumThreadAddress || !provider || !getDisplayName) return;
    if (threads.length === 0) return;
    // Only attempt once per userRegistryAddress change to prevent infinite loops
    if (hasAttemptedDisplayNameFetch.current) return;

    // Check if any non-deleted threads are missing display names
    const hasMissingNames = threads.some(t => !t.displayName && !t.isDeleted);

    if (hasMissingNames && userRegistryAddress) {
      hasAttemptedDisplayNameFetch.current = true;
      loadThreads();
    }
  }, [forumThreadAddress, provider, getDisplayName, userRegistryAddress, threads, loadThreads]);

  // Poll for new threads periodically
  useEffect(() => {
    if (!forumThreadAddress || !provider) return;

    pollIntervalRef.current = window.setInterval(() => {
      loadThreads();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [forumThreadAddress, provider, loadThreads]);

  return {
    threads,
    isLoading,
    error,
    threadCount,
    createThread,
    editThread,
    deleteThread,
    refresh: loadThreads,
    getThread,
    loadByAuthor,
  };
}
