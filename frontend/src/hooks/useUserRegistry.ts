import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import type { Profile, Link } from "../types/contracts";
import UserRegistryABI from "../contracts/UserRegistry.json";
import { createReadContract, createWriteContract, type Provider, type Signer } from "../utils/contracts";

interface UseUserRegistryProps {
  registryAddress: string | null;
  provider: Provider | null;
  userAddress: string | null;
  signer?: Signer | null;
  enabled?: boolean;
}

interface UseUserRegistryReturn {
  // State
  profile: Profile | null;
  links: Link[];
  isLoading: boolean;
  error: string | null;

  // Profile actions
  createProfile: (displayName: string, bio: string) => Promise<void>;
  createDefaultProfile: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateBio: (bio: string) => Promise<void>;
  transferProfileOwnership: (newOwner: string) => Promise<void>;

  // Link actions
  addLink: (name: string, url: string) => Promise<void>;
  removeLink: (index: number) => Promise<void>;
  clearLinks: () => Promise<void>;

  // Delegate actions
  addDelegate: (delegateAddress: string) => Promise<void>;
  removeDelegate: (delegateAddress: string) => Promise<void>;
  isDelegate: (delegateAddress: string) => Promise<boolean>;

  // Session key actions (for ECDH encryption)
  setSessionPublicKey: (sessionPubKey: Uint8Array) => Promise<void>;
  clearSessionPublicKey: () => Promise<void>;
  getSessionPublicKey: (address: string) => Promise<string>;
  hasSessionPublicKey: (address: string) => Promise<boolean>;

  // Lookup
  resolveToOwner: (address: string) => Promise<string>;
  getProfile: (address: string) => Promise<Profile>;
  hasProfile: (address: string) => Promise<boolean>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useUserRegistry({
  registryAddress,
  provider,
  userAddress,
  signer,
  enabled = true,
}: UseUserRegistryProps): UseUserRegistryReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getReadContract = useCallback(() => {
    return createReadContract(registryAddress, UserRegistryABI.abi, provider);
  }, [registryAddress, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(registryAddress, UserRegistryABI.abi, provider, signer ?? null);
  }, [registryAddress, provider, signer]);

  const loadProfile = useCallback(async () => {
    if (!userAddress) {
      setProfile(null);
      setLinks([]);
      return;
    }

    const contract = getReadContract();
    if (!contract) return;

    try {
      setIsLoading(true);
      setError(null);

      const profileData = await contract.getProfile(userAddress);
      setProfile({
        owner: profileData.owner,
        displayName: profileData.displayName,
        bio: profileData.bio,
        exists: profileData.exists,
      });

      if (profileData.exists) {
        const linksData = await contract.getLinks(userAddress);
        setLinks(
          linksData.map((l: { name: string; url: string }) => ({
            name: l.name,
            url: l.url,
          }))
        );
      } else {
        setLinks([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, getReadContract]);

  useEffect(() => {
    if (enabled) {
      loadProfile();
    }
  }, [enabled, userAddress, registryAddress, provider, loadProfile]);

  const createProfile = useCallback(
    async (displayName: string, bio: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.createProfile(displayName, bio);
      await tx.wait();
      await loadProfile();
    },
    [enabled, getWriteContract, loadProfile]
  );

  const createDefaultProfile = useCallback(async () => {
    if (!enabled) throw new Error("Wallet not ready");
    const contract = await getWriteContract();
    if (!contract) throw new Error("Contract not available");

    const tx = await contract.createDefaultProfile();
    await tx.wait();
    await loadProfile();
  }, [enabled, getWriteContract, loadProfile]);

  const transferProfileOwnership = useCallback(
    async (newOwner: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.transferProfileOwnership(newOwner);
      await tx.wait();
      // After transfer, the current user no longer has a profile
      setProfile(null);
      setLinks([]);
    },
    [enabled, getWriteContract]
  );

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.setDisplayName(displayName);
      await tx.wait();
      await loadProfile();
    },
    [enabled, getWriteContract, loadProfile]
  );

  const updateBio = useCallback(
    async (bio: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.setBio(bio);
      await tx.wait();
      await loadProfile();
    },
    [enabled, getWriteContract, loadProfile]
  );

  const addLink = useCallback(
    async (name: string, url: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.addLink(name, url);
      await tx.wait();
      await loadProfile();
    },
    [enabled, getWriteContract, loadProfile]
  );

  const removeLink = useCallback(
    async (index: number) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.removeLink(index);
      await tx.wait();
      await loadProfile();
    },
    [enabled, getWriteContract, loadProfile]
  );

  const clearLinks = useCallback(async () => {
    if (!enabled) throw new Error("Wallet not ready");
    const contract = await getWriteContract();
    if (!contract) throw new Error("Contract not available");

    const tx = await contract.clearLinks();
    await tx.wait();
    await loadProfile();
  }, [enabled, getWriteContract, loadProfile]);

  const addDelegate = useCallback(
    async (delegateAddress: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.addDelegate(delegateAddress);
      await tx.wait();
    },
    [enabled, getWriteContract]
  );

  const removeDelegate = useCallback(
    async (delegateAddress: string) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.removeDelegate(delegateAddress);
      await tx.wait();
    },
    [enabled, getWriteContract]
  );

  const isDelegate = useCallback(
    async (delegateAddress: string): Promise<boolean> => {
      if (!userAddress) return false;
      const contract = getReadContract();
      if (!contract) return false;

      return contract.isDelegate(userAddress, delegateAddress);
    },
    [getReadContract, userAddress]
  );

  const resolveToOwner = useCallback(
    async (address: string): Promise<string> => {
      const contract = getReadContract();
      if (!contract) return ethers.ZeroAddress;

      return contract.resolveToOwner(address);
    },
    [getReadContract]
  );

  const getProfileFn = useCallback(
    async (address: string): Promise<Profile> => {
      const contract = getReadContract();
      if (!contract) throw new Error("Contract not available");

      const p = await contract.getProfile(address);
      return {
        owner: p.owner,
        displayName: p.displayName,
        bio: p.bio,
        exists: p.exists,
      };
    },
    [getReadContract]
  );

  const hasProfile = useCallback(
    async (address: string): Promise<boolean> => {
      const contract = getReadContract();
      if (!contract) return false;

      return contract.hasProfile(address);
    },
    [getReadContract]
  );

  // Session key functions for ECDH encryption
  const setSessionPublicKey = useCallback(
    async (sessionPubKey: Uint8Array) => {
      if (!enabled) throw new Error("Wallet not ready");
      const contract = await getWriteContract();
      if (!contract) throw new Error("Contract not available");

      const tx = await contract.setSessionPublicKey(sessionPubKey);
      await tx.wait();
    },
    [enabled, getWriteContract]
  );

  const clearSessionPublicKeyFn = useCallback(async () => {
    if (!enabled) throw new Error("Wallet not ready");
    const contract = await getWriteContract();
    if (!contract) throw new Error("Contract not available");

    const tx = await contract.clearSessionPublicKey();
    await tx.wait();
  }, [enabled, getWriteContract]);

  const getSessionPublicKey = useCallback(
    async (address: string): Promise<string> => {
      const contract = getReadContract();
      if (!contract) return "";

      return contract.getSessionPublicKey(address);
    },
    [getReadContract]
  );

  const hasSessionPublicKeyFn = useCallback(
    async (address: string): Promise<boolean> => {
      const contract = getReadContract();
      if (!contract) return false;

      return contract.hasSessionPublicKey(address);
    },
    [getReadContract]
  );

  return {
    profile,
    links,
    isLoading,
    error,
    createProfile,
    createDefaultProfile,
    updateDisplayName,
    updateBio,
    transferProfileOwnership,
    addLink,
    removeLink,
    clearLinks,
    addDelegate,
    removeDelegate,
    isDelegate,
    setSessionPublicKey,
    clearSessionPublicKey: clearSessionPublicKeyFn,
    getSessionPublicKey,
    hasSessionPublicKey: hasSessionPublicKeyFn,
    resolveToOwner,
    getProfile: getProfileFn,
    hasProfile,
    refresh: loadProfile,
  };
}
