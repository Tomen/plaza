import { useState, useEffect } from 'react';
import { ethers, BrowserProvider } from 'ethers';

export interface WalletState {
  address: string | null;
  provider: BrowserProvider | null;
  signer: ethers.Signer | null;
  isConnecting: boolean;
  isInitialized: boolean; // True after initial connection check completes
  error: string | null;
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    address: null,
    provider: null,
    signer: null,
    isConnecting: false,
    isInitialized: false,
    error: null,
  });

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      checkConnection();
      setupEventListeners();
    } else {
      // No MetaMask, mark as initialized immediately
      setWalletState(prev => ({ ...prev, isInitialized: true }));
    }
  }, []);

  const checkConnection = async () => {
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();

      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWalletState({
          address,
          provider,
          signer,
          isConnecting: false,
          isInitialized: true,
          error: null,
        });
      } else {
        // No accounts connected, but check is complete
        setWalletState(prev => ({ ...prev, isInitialized: true }));
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setWalletState(prev => ({ ...prev, isInitialized: true }));
    }
  };

  const setupEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect();
    } else {
      checkConnection();
    }
  };

  const connect = async () => {
    if (typeof window.ethereum === 'undefined') {
      setWalletState(prev => ({
        ...prev,
        error: 'MetaMask is not installed. Please install it to use this app.',
      }));
      return;
    }

    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setWalletState({
        address,
        provider,
        signer,
        isConnecting: false,
        isInitialized: true,
        error: null,
      });
    } catch (error: any) {
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect wallet',
      }));
    }
  };

  const disconnect = () => {
    setWalletState({
      address: null,
      provider: null,
      signer: null,
      isConnecting: false,
      isInitialized: true, // Stay initialized after disconnect
      error: null,
    });
  };

  return {
    ...walletState,
    connect,
    disconnect,
  };
}
