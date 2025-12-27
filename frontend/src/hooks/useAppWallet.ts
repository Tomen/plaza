import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import {
  getOrCreateAppWallet,
  saveAppWallet,
  getStoredWalletInfo,
  isWalletAuthorizedFor,
  getOrCreateStandaloneWallet,
  clearStandaloneWallet,
  getPrivateKeyForExport,
  hasStandaloneWallet,
} from "../utils/appWallet";

export type WalletMode = 'browser' | 'standalone' | 'none';
export type WalletState = 'idle' | 'initializing' | 'ready' | 'error';

interface UseAppWalletProps {
  userAddress: string | null;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  checkDelegateOnChain?: (delegateAddress: string) => Promise<boolean>;
  mode?: WalletMode;
}

interface UseAppWalletReturn {
  // State
  appWallet: ethers.Wallet | null;
  appWalletAddress: string | null;
  balance: bigint;
  isAuthorized: boolean;
  isCheckingAuth: boolean;
  isLoading: boolean;
  error: string | null;
  mode: WalletMode;
  walletState: WalletState;
  isReady: boolean;

  // Actions
  initializeWallet: () => void;
  authorizeDelegate: (addDelegateFn: (address: string) => Promise<void>) => Promise<void>;
  fundWallet: (amount: bigint) => Promise<void>;
  refreshBalance: () => Promise<void>;
  disconnect: () => void;

  // Standalone mode actions
  initializeStandaloneWallet: (provider: ethers.Provider) => void;
  getPrivateKey: () => string | null;
  hasExistingStandaloneWallet: () => boolean;
  deleteStandaloneWallet: () => void;
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
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<WalletMode>(mode);
  const [walletState, setWalletState] = useState<WalletState>('idle');

  // Update mode when prop changes
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // Check authorization status on-chain
  const checkAuthorization = useCallback(async () => {
    // Can't check if wallet or callback not available yet
    if (!appWallet || !userAddress || !checkDelegateOnChain) {
      return;
    }

    setIsCheckingAuth(true);
    try {
      const authorized = await checkDelegateOnChain(appWallet.address);
      setIsAuthorized(authorized);
    } catch {
      setIsAuthorized(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [appWallet, userAddress, checkDelegateOnChain]);

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!appWallet) {
      setBalance(0n);
      return;
    }

    // Use the wallet's connected provider if available, otherwise fall back to prop
    const balanceProvider = appWallet.provider ?? provider;
    if (!balanceProvider) {
      setBalance(0n);
      return;
    }

    try {
      const bal = await balanceProvider.getBalance(appWallet.address);
      setBalance(bal);
    } catch {
      setBalance(0n);
    }
  }, [appWallet, provider]);

  // Initialize wallet from storage or create new (browser mode)
  const initializeWallet = useCallback(() => {
    if (!userAddress) return;

    setWalletState('initializing');
    setError(null);

    try {
      const stored = getStoredWalletInfo();

      // If we have a wallet for this user, load it
      // Authorization will be verified on-chain by checkAuthorization()
      let wallet: ethers.Wallet;
      if (stored && isWalletAuthorizedFor(userAddress)) {
        wallet = new ethers.Wallet(stored.privateKey);
      } else {
        // Create a new wallet but don't save yet
        wallet = getOrCreateAppWallet(userAddress);
      }

      // Connect wallet to provider if available (needed for sendTransaction)
      if (provider) {
        wallet = wallet.connect(provider);
      }

      setAppWallet(wallet);
      setWalletState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize wallet');
      setWalletState('error');
    }
  }, [userAddress, provider]);

  // Load existing wallet on mount (browser mode only)
  useEffect(() => {
    // Only handle browser mode here; standalone mode is initialized via initializeStandaloneWallet
    if (mode === 'browser') {
      if (userAddress) {
        initializeWallet();
      } else {
        setAppWallet(null);
        setIsAuthorized(false);
        setBalance(0n);
        setWalletState('idle');
      }
    }
  }, [userAddress, initializeWallet, mode]);

  // Check authorization when wallet, provider, or check function changes
  // This triggers when userRegistry becomes available (provides checkDelegateOnChain)
  useEffect(() => {
    if (appWallet) {
      checkAuthorization();
      if (provider) {
        refreshBalance();
      }
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

  // Disconnect (clears session state but preserves wallets in localStorage)
  // Both standalone and delegate wallets are preserved so user can reconnect
  // The on-chain delegation still exists, so we shouldn't delete the wallet
  const disconnect = useCallback(() => {
    setAppWallet(null);
    setIsAuthorized(false);
    setBalance(0n);
    setError(null);
    setWalletState('idle');
  }, []);

  // Initialize standalone wallet (for in-app wallet mode)
  const initializeStandaloneWallet = useCallback((walletProvider: ethers.Provider): void => {
    setWalletState('initializing');
    setError(null);

    try {
      const wallet = getOrCreateStandaloneWallet();
      const connectedWallet = wallet.connect(walletProvider);
      setAppWallet(connectedWallet);
      setCurrentMode('standalone');
      // In standalone mode, wallet is always "authorized" (it is the primary identity)
      setIsAuthorized(true);
      setWalletState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize wallet');
      setWalletState('error');
    }
  }, []);

  // Get private key for export (standalone mode)
  const getPrivateKey = useCallback((): string | null => {
    return getPrivateKeyForExport();
  }, []);

  // Check if standalone wallet exists
  const hasExistingStandaloneWallet = useCallback((): boolean => {
    return hasStandaloneWallet();
  }, []);

  // Permanently delete standalone wallet from localStorage
  const deleteStandaloneWallet = useCallback(() => {
    clearStandaloneWallet();
    setAppWallet(null);
    setIsAuthorized(false);
    setBalance(0n);
    setError(null);
    setWalletState('idle');
  }, []);

  return {
    appWallet,
    appWalletAddress: appWallet?.address ?? null,
    balance,
    isAuthorized,
    isCheckingAuth,
    isLoading,
    error,
    mode: currentMode,
    walletState,
    isReady: walletState === 'ready',
    initializeWallet,
    authorizeDelegate,
    fundWallet,
    refreshBalance,
    disconnect,
    initializeStandaloneWallet,
    getPrivateKey,
    hasExistingStandaloneWallet,
    deleteStandaloneWallet,
  };
}
