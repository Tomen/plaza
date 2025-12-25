import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import {
  getOrCreateAppWallet,
  saveAppWallet,
  getStoredWalletInfo,
  clearAppWallet,
  isWalletAuthorizedFor,
} from "../utils/appWallet";

interface UseAppWalletProps {
  userAddress: string | null;
  provider: ethers.BrowserProvider | null;
  checkDelegateOnChain?: (delegateAddress: string) => Promise<boolean>;
}

interface UseAppWalletReturn {
  // State
  appWallet: ethers.Wallet | null;
  appWalletAddress: string | null;
  balance: bigint;
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initializeWallet: () => void;
  authorizeDelegate: (addDelegateFn: (address: string) => Promise<void>) => Promise<void>;
  fundWallet: (amount: bigint) => Promise<void>;
  refreshBalance: () => Promise<void>;
  disconnect: () => void;
}

export function useAppWallet({
  userAddress,
  provider,
  checkDelegateOnChain,
}: UseAppWalletProps): UseAppWalletReturn {
  const [appWallet, setAppWallet] = useState<ethers.Wallet | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authorization status
  const checkAuthorization = useCallback(async () => {
    if (!appWallet || !userAddress || !checkDelegateOnChain) {
      setIsAuthorized(false);
      return;
    }

    try {
      const authorized = await checkDelegateOnChain(appWallet.address);
      setIsAuthorized(authorized);
    } catch {
      setIsAuthorized(false);
    }
  }, [appWallet, userAddress, checkDelegateOnChain]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!appWallet || !provider) {
      setBalance(0n);
      return;
    }

    try {
      const bal = await provider.getBalance(appWallet.address);
      setBalance(bal);
    } catch {
      setBalance(0n);
    }
  }, [appWallet, provider]);

  // Initialize wallet from storage or create new
  const initializeWallet = useCallback(() => {
    if (!userAddress) return;

    const stored = getStoredWalletInfo();

    // If we have a wallet for this user, use it
    if (stored && isWalletAuthorizedFor(userAddress)) {
      const wallet = new ethers.Wallet(stored.privateKey);
      setAppWallet(wallet);
    } else {
      // Create a new wallet but don't save yet
      const wallet = getOrCreateAppWallet(userAddress);
      setAppWallet(wallet);
    }
  }, [userAddress]);

  // Load existing wallet on mount
  useEffect(() => {
    if (userAddress) {
      initializeWallet();
    } else {
      setAppWallet(null);
      setIsAuthorized(false);
      setBalance(0n);
    }
  }, [userAddress, initializeWallet]);

  // Check authorization and balance when wallet or provider changes
  useEffect(() => {
    if (appWallet && provider) {
      checkAuthorization();
      refreshBalance();
    }
  }, [appWallet, provider, checkAuthorization, refreshBalance]);

  // Authorize the app wallet as a delegate
  const authorizeDelegate = useCallback(
    async (addDelegateFn: (address: string) => Promise<void>) => {
      if (!appWallet || !userAddress) {
        throw new Error("Wallet not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        // Add the app wallet as a delegate on-chain
        await addDelegateFn(appWallet.address);

        // Save wallet to localStorage after successful authorization
        saveAppWallet(appWallet, userAddress);

        setIsAuthorized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to authorize delegate");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appWallet, userAddress]
  );

  // Fund the app wallet with gas
  const fundWallet = useCallback(
    async (amount: bigint) => {
      if (!appWallet || !provider) {
        throw new Error("Wallet not initialized");
      }

      setIsLoading(true);
      setError(null);

      try {
        const signer = await provider.getSigner();
        const tx = await signer.sendTransaction({
          to: appWallet.address,
          value: amount,
        });
        await tx.wait();
        await refreshBalance();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fund wallet");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [appWallet, provider, refreshBalance]
  );

  // Disconnect and clear
  const disconnect = useCallback(() => {
    clearAppWallet();
    setAppWallet(null);
    setIsAuthorized(false);
    setBalance(0n);
    setError(null);
  }, []);

  return {
    appWallet,
    appWalletAddress: appWallet?.address ?? null,
    balance,
    isAuthorized,
    isLoading,
    error,
    initializeWallet,
    authorizeDelegate,
    fundWallet,
    refreshBalance,
    disconnect,
  };
}
