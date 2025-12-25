import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import {
  getOrCreateAppWallet,
  saveAppWallet,
  getStoredWalletInfo,
  clearAppWallet,
  isWalletAuthorizedFor,
  getOrCreateStandaloneWallet,
  getStoredStandaloneWallet,
  clearStandaloneWallet,
  getPrivateKeyForExport,
  hasStandaloneWallet,
} from "../utils/appWallet";

export type WalletMode = 'browser' | 'standalone' | 'none';

interface UseAppWalletProps {
  userAddress: string | null;
  provider: ethers.BrowserProvider | null;
  checkDelegateOnChain?: (delegateAddress: string) => Promise<boolean>;
  mode?: WalletMode;
}

interface UseAppWalletReturn {
  // State
  appWallet: ethers.Wallet | null;
  appWalletAddress: string | null;
  balance: bigint;
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  mode: WalletMode;

  // Actions
  initializeWallet: () => void;
  authorizeDelegate: (addDelegateFn: (address: string) => Promise<void>) => Promise<void>;
  fundWallet: (amount: bigint) => Promise<void>;
  refreshBalance: () => Promise<void>;
  disconnect: () => void;

  // Standalone mode actions
  initializeStandaloneWallet: (provider: ethers.Provider) => ethers.Wallet;
  getPrivateKey: () => string | null;
  hasExistingStandaloneWallet: () => boolean;
}

export function useAppWallet({
  userAddress,
  provider,
  checkDelegateOnChain,
  mode = 'browser',
}: UseAppWalletProps): UseAppWalletReturn {
  const [appWallet, setAppWallet] = useState<ethers.Wallet | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<WalletMode>(mode);

  // Update mode when prop changes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

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
    if (currentMode === 'standalone') {
      clearStandaloneWallet();
    } else {
      clearAppWallet();
    }
    setAppWallet(null);
    setIsAuthorized(false);
    setBalance(0n);
    setError(null);
  }, [currentMode]);

  // Initialize standalone wallet (for in-app wallet mode)
  const initializeStandaloneWallet = useCallback((walletProvider: ethers.Provider): ethers.Wallet => {
    const wallet = getOrCreateStandaloneWallet();
    const connectedWallet = wallet.connect(walletProvider);
    setAppWallet(connectedWallet);
    setCurrentMode('standalone');
    // In standalone mode, wallet is always "authorized" (it is the primary identity)
    setIsAuthorized(true);
    return connectedWallet;
  }, []);

  // Get private key for export (standalone mode)
  const getPrivateKey = useCallback((): string | null => {
    return getPrivateKeyForExport();
  }, []);

  // Check if standalone wallet exists
  const hasExistingStandaloneWallet = useCallback((): boolean => {
    return hasStandaloneWallet();
  }, []);

  return {
    appWallet,
    appWalletAddress: appWallet?.address ?? null,
    balance,
    isAuthorized,
    isLoading,
    error,
    mode: currentMode,
    initializeWallet,
    authorizeDelegate,
    fundWallet,
    refreshBalance,
    disconnect,
    initializeStandaloneWallet,
    getPrivateKey,
    hasExistingStandaloneWallet,
  };
}
