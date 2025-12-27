import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import type { Reply } from "../types/contracts";
import RepliesABI from "../contracts/Replies.json";
import { createReadContract, createWriteContract, type Provider, type Signer } from "../utils/contracts";

// Entity types for the shared Replies contract
export const EntityType = {
  UserPost: 0,
  FeedItem: 1,
  ForumThread: 2,
  Reply: 3,
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

interface UseRepliesProps {
  repliesAddress: string | null;
  parentContract: string | null; // e.g., UserPosts address
  entityType: EntityType;
  entityIndex: number | null; // Post index
  provider: Provider | null;
  signer?: Signer | null;
  getDisplayName?: (address: string) => Promise<string>;
  enabled?: boolean;
}

interface UseRepliesReturn {
  // State
  replies: Reply[];
  replyCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  addReply: (content: string, parentReplyIndex?: number) => Promise<number>;
  editReply: (replyIndex: number, newContent: string) => Promise<void>;
  deleteReply: (replyIndex: number) => Promise<void>;
  refresh: () => Promise<void>;

  // Helpers
  getParentId: () => Promise<string | null>;
  getChildReplies: (replyIndex: number) => Promise<Reply[]>;
}

// Raw reply from contract
interface RawReply {
  parentId: string;
  profileOwner: string;
  sender: string;
  content: string;
  timestamp: bigint;
  editedAt: bigint;
  isDeleted: boolean;
  parentReplyIndex: bigint;
  depth: bigint;
}

export function useReplies({
  repliesAddress,
  parentContract,
  entityType,
  entityIndex,
  provider,
  signer,
  getDisplayName,
  enabled = true,
}: UseRepliesProps): UseRepliesReturn {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyCount, setReplyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(repliesAddress, RepliesABI.abi, provider);
  }, [repliesAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(repliesAddress, RepliesABI.abi, provider, signer ?? null);
  }, [repliesAddress, provider, signer]);

  const computeParentId = useCallback(async (): Promise<string | null> => {
    if (!parentContract || entityIndex === null) return null;

    const contract = getReadContract();
    if (!contract) {
      // Fallback: compute client-side
      return ethers.solidityPackedKeccak256(
        ["address", "uint8", "uint256"],
        [parentContract, entityType, entityIndex]
      );
    }

    try {
      return await contract.getParentId(parentContract, entityType, entityIndex);
    } catch {
      return null;
    }
  }, [getReadContract, parentContract, entityType, entityIndex]);

  const formatReply = useCallback(
    async (raw: RawReply, index: number): Promise<Reply> => {
      let displayName: string | undefined;
      if (getDisplayName) {
        try {
          displayName = await getDisplayName(raw.profileOwner);
        } catch {
          displayName = undefined;
        }
      }

      return {
        index,
        parentId: raw.parentId,
        profileOwner: raw.profileOwner,
        sender: raw.sender,
        content: raw.content,
        timestamp: Number(raw.timestamp),
        editedAt: raw.editedAt > 0n ? Number(raw.editedAt) : null,
        isDeleted: raw.isDeleted,
        parentReplyIndex: Number(raw.parentReplyIndex),
        depth: Number(raw.depth),
        displayName,
      };
    },
    [getDisplayName]
  );

  const loadReplies = useCallback(async () => {
    const contract = getReadContract();
    const parentId = await computeParentId();

    if (!contract || !parentId) {
      setReplies([]);
      setReplyCount(0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get top-level reply count
      const count = await contract.getTopLevelReplyCount(parentId);
      setReplyCount(Number(count));

      if (count === 0n) {
        setReplies([]);
        return;
      }

      // Load latest 50 top-level replies
      const limit = count > 50n ? 50n : count;
      const [rawReplies, indices] = await contract.getLatestTopLevelReplies(parentId, limit);

      // Format replies with display names
      const formatted: Reply[] = await Promise.all(
        rawReplies.map((raw: RawReply, i: number) => formatReply(raw, Number(indices[i])))
      );

      setReplies(formatted);
    } catch (err) {
      console.error("Failed to load replies:", err);
      setError(err instanceof Error ? err.message : "Failed to load replies");
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract, computeParentId, formatReply]);

  const fetchChildReplies = useCallback(
    async (replyIndex: number): Promise<Reply[]> => {
      const contract = getReadContract();
      if (!contract) return [];

      try {
        const count = await contract.getChildReplyCount(replyIndex);
        if (count === 0n) return [];

        const [rawReplies, indices] = await contract.getChildReplies(replyIndex, 0, count);

        return await Promise.all(
          rawReplies.map((raw: RawReply, i: number) => formatReply(raw, Number(indices[i])))
        );
      } catch (err) {
        console.error("Failed to load child replies:", err);
        return [];
      }
    },
    [getReadContract, formatReply]
  );

  const addReply = useCallback(
    async (content: string, parentReplyIndex: number = 0): Promise<number> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!content.trim()) throw new Error("Reply content cannot be empty");
      if (!parentContract || entityIndex === null) throw new Error("Parent entity not set");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        // parentReplyIndex: 0 = top-level, 1-indexed for nested
        const tx = await contract.addReply(
          parentContract,
          entityType,
          entityIndex,
          content,
          parentReplyIndex
        );
        const receipt = await tx.wait();

        // Extract reply index from event
        const event = receipt.logs.find((log: { topics: readonly string[]; data: string }) => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === "ReplyCreated";
          } catch {
            return false;
          }
        });

        let replyIndex = 0;
        if (event) {
          const parsed = contract.interface.parseLog(event);
          replyIndex = Number(parsed?.args?.replyIndex ?? 0);
        }

        await loadReplies();
        return replyIndex;
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to add reply");
      }
    },
    [enabled, getWriteContract, parentContract, entityType, entityIndex, loadReplies]
  );

  const editReply = useCallback(
    async (replyIndex: number, newContent: string): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!newContent.trim()) throw new Error("Reply content cannot be empty");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.editReply(replyIndex, newContent);
        await tx.wait();
        await loadReplies();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to edit reply");
      }
    },
    [enabled, getWriteContract, loadReplies]
  );

  const deleteReply = useCallback(
    async (replyIndex: number): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.deleteReply(replyIndex);
        await tx.wait();
        await loadReplies();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to delete reply");
      }
    },
    [enabled, getWriteContract, loadReplies]
  );

  // Load replies when parent entity changes
  useEffect(() => {
    if (repliesAddress && provider && parentContract && entityIndex !== null) {
      loadReplies();
    } else {
      setReplies([]);
      setReplyCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repliesAddress, provider, parentContract, entityType, entityIndex, getDisplayName]);

  // Poll for new replies every 30 seconds
  useEffect(() => {
    if (!repliesAddress || !provider || !parentContract || entityIndex === null) return;

    pollIntervalRef.current = window.setInterval(() => {
      loadReplies();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repliesAddress, provider, parentContract, entityType, entityIndex]);

  return {
    replies,
    replyCount,
    isLoading,
    error,
    addReply,
    editReply,
    deleteReply,
    refresh: loadReplies,
    getParentId: computeParentId,
    getChildReplies: fetchChildReplies,
  };
}
