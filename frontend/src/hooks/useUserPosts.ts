import { useState, useCallback, useEffect, useRef } from "react";
import type { UserPost } from "../types/contracts";
import UserPostsABI from "../contracts/UserPosts.json";
import { createReadContract, createWriteContract, type Provider, type Signer } from "../utils/contracts";

interface UseUserPostsProps {
  userPostsAddress: string | null;
  userAddress: string | null; // Profile owner whose posts to load
  provider: Provider | null;
  signer?: Signer | null;
  getDisplayName?: (address: string) => Promise<string>;
  enabled?: boolean;
}

interface UseUserPostsReturn {
  // State
  posts: UserPost[];
  isLoading: boolean;
  error: string | null;

  // Actions
  createPost: (content: string) => Promise<number>;
  editPost: (postIndex: number, newContent: string) => Promise<void>;
  deletePost: (postIndex: number) => Promise<void>;
  refresh: () => Promise<void>;

  // Metadata
  postCount: number;
}

// Raw post from contract
interface RawPost {
  profileOwner: string;
  sender: string;
  content: string;
  timestamp: bigint;
  editedAt: bigint;
  isDeleted: boolean;
}

export function useUserPosts({
  userPostsAddress,
  userAddress,
  provider,
  signer,
  getDisplayName,
  enabled = true,
}: UseUserPostsProps): UseUserPostsReturn {
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<number | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(userPostsAddress, UserPostsABI.abi, provider);
  }, [userPostsAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(userPostsAddress, UserPostsABI.abi, provider, signer ?? null);
  }, [userPostsAddress, provider, signer]);

  const formatPost = useCallback(
    async (raw: RawPost, index: number): Promise<UserPost> => {
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
        profileOwner: raw.profileOwner,
        sender: raw.sender,
        content: raw.content,
        timestamp: Number(raw.timestamp),
        editedAt: raw.editedAt > 0n ? Number(raw.editedAt) : null,
        isDeleted: raw.isDeleted,
        displayName,
      };
    },
    [getDisplayName]
  );

  const loadPosts = useCallback(async () => {
    const contract = getReadContract();
    if (!contract || !userAddress) {
      setPosts([]);
      setPostCount(0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get post count for this user
      const count = await contract.getUserPostCount(userAddress);
      setPostCount(Number(count));

      if (count === 0n) {
        setPosts([]);
        return;
      }

      // Load latest 50 posts for this user (newest first)
      const limit = count > 50n ? 50n : count;
      const [rawPosts, indices] = await contract.getLatestUserPosts(userAddress, limit);

      // Format posts with display names
      const formatted: UserPost[] = await Promise.all(
        rawPosts.map((raw: RawPost, i: number) => formatPost(raw, Number(indices[i])))
      );

      setPosts(formatted);
    } catch (err) {
      console.error("Failed to load posts:", err);
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setIsLoading(false);
    }
  }, [getReadContract, userAddress, formatPost]);

  const createPost = useCallback(
    async (content: string): Promise<number> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!content.trim()) throw new Error("Post content cannot be empty");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.createPost(content);
        const receipt = await tx.wait();

        // Extract post index from event
        const event = receipt.logs.find((log: { topics: readonly string[]; data: string }) => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === "PostCreated";
          } catch {
            return false;
          }
        });

        let postIndex = 0;
        if (event) {
          const parsed = contract.interface.parseLog(event);
          postIndex = Number(parsed?.args?.postIndex ?? 0);
        }

        await loadPosts();
        return postIndex;
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to create post");
      }
    },
    [enabled, getWriteContract, loadPosts]
  );

  const editPost = useCallback(
    async (postIndex: number, newContent: string): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (!newContent.trim()) throw new Error("Post content cannot be empty");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.editPost(postIndex, newContent);
        await tx.wait();
        await loadPosts();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to edit post");
      }
    },
    [enabled, getWriteContract, loadPosts]
  );

  const deletePost = useCallback(
    async (postIndex: number): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");

      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      try {
        const tx = await contract.deletePost(postIndex);
        await tx.wait();
        await loadPosts();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to delete post");
      }
    },
    [enabled, getWriteContract, loadPosts]
  );

  // Load posts when user changes or getDisplayName becomes available
  useEffect(() => {
    if (userPostsAddress && provider && userAddress) {
      loadPosts();
    } else {
      setPosts([]);
      setPostCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPostsAddress, provider, userAddress, getDisplayName]);

  // Poll for new posts every 30 seconds
  useEffect(() => {
    if (!userPostsAddress || !provider || !userAddress) return;

    pollIntervalRef.current = window.setInterval(() => {
      loadPosts();
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPostsAddress, provider, userAddress]);

  return {
    posts,
    isLoading,
    error,
    createPost,
    editPost,
    deletePost,
    refresh: loadPosts,
    postCount,
  };
}
