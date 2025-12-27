import { useState, useCallback } from "react";
import { ethers } from "ethers";
import type { VoteType, VoteTally } from "../types/contracts";
import { VoteType as VoteTypeEnum } from "../types/contracts";
import VotingABI from "../contracts/Voting.json";
import { createReadContract, createWriteContract, type Provider, type Signer } from "../utils/contracts";

// Entity types for the shared Voting contract
export const EntityType = {
  UserPost: 0,
  FeedItem: 1,
  ForumThread: 2,
  Reply: 3,
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

interface UseVotingProps {
  votingAddress: string | null;
  provider: Provider | null;
  signer?: Signer | null;
  userAddress: string | null;
  enabled?: boolean;
}

interface UseVotingReturn {
  // Actions
  vote: (entityId: string, voteType: VoteType) => Promise<void>;
  removeVote: (entityId: string) => Promise<void>;

  // Queries
  getVoteTally: (entityId: string) => Promise<VoteTally>;
  getUserVote: (entityId: string, voter?: string) => Promise<VoteType>;
  computeEntityId: (contractAddress: string, entityType: EntityType, entityIndex: number) => Promise<string>;

  // State
  isVoting: boolean;
  error: string | null;
}

export function useVoting({
  votingAddress,
  provider,
  signer,
  userAddress,
  enabled = true,
}: UseVotingProps): UseVotingReturn {
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(votingAddress, VotingABI.abi, provider);
  }, [votingAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(votingAddress, VotingABI.abi, provider, signer ?? null);
  }, [votingAddress, provider, signer]);

  const computeEntityId = useCallback(
    async (contractAddress: string, entityType: EntityType, entityIndex: number): Promise<string> => {
      const contract = getReadContract();
      if (!contract) {
        // Fallback: compute client-side using ethers
        return ethers.solidityPackedKeccak256(
          ["address", "uint8", "uint256"],
          [contractAddress, entityType, entityIndex]
        );
      }
      return contract.getEntityId(contractAddress, entityType, entityIndex);
    },
    [getReadContract]
  );

  const getVoteTally = useCallback(
    async (entityId: string): Promise<VoteTally> => {
      const contract = getReadContract();
      if (!contract) {
        return { upvotes: 0, downvotes: 0, score: 0 };
      }

      try {
        const [upvotes, downvotes] = await contract.getTally(entityId);
        const score = await contract.getScore(entityId);
        return {
          upvotes: Number(upvotes),
          downvotes: Number(downvotes),
          score: Number(score),
        };
      } catch (err) {
        console.error("Failed to get vote tally:", err);
        return { upvotes: 0, downvotes: 0, score: 0 };
      }
    },
    [getReadContract]
  );

  const getUserVote = useCallback(
    async (entityId: string, voter?: string): Promise<VoteType> => {
      const contract = getReadContract();
      const voterAddress = voter ?? userAddress;
      if (!contract || !voterAddress) {
        return VoteTypeEnum.None;
      }

      try {
        const voteType = await contract.getUserVote(entityId, voterAddress);
        return Number(voteType) as VoteType;
      } catch (err) {
        console.error("Failed to get user vote:", err);
        return VoteTypeEnum.None;
      }
    },
    [getReadContract, userAddress]
  );

  const vote = useCallback(
    async (entityId: string, voteType: VoteType): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");
      if (voteType === VoteTypeEnum.None) {
        throw new Error("Cannot vote with VoteType.None, use removeVote instead");
      }

      const contract = await getWriteContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      setIsVoting(true);
      setError(null);

      try {
        const tx = await contract.vote(entityId, voteType);
        await tx.wait();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to vote";
        setError(message);
        throw err;
      } finally {
        setIsVoting(false);
      }
    },
    [enabled, getWriteContract]
  );

  const removeVote = useCallback(
    async (entityId: string): Promise<void> => {
      if (!enabled) throw new Error("Wallet not ready");

      const contract = await getWriteContract();
      if (!contract) {
        throw new Error("Contract not available");
      }

      setIsVoting(true);
      setError(null);

      try {
        const tx = await contract.removeVote(entityId);
        await tx.wait();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove vote";
        setError(message);
        throw err;
      } finally {
        setIsVoting(false);
      }
    },
    [enabled, getWriteContract]
  );

  return {
    vote,
    removeVote,
    getVoteTally,
    getUserVote,
    computeEntityId,
    isVoting,
    error,
  };
}
