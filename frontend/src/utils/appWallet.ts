import { ethers } from "ethers";
import type { StoredWallet } from "../types/contracts";

const STORAGE_KEY = "on-chain-chat-app-wallet";
const STANDALONE_STORAGE_KEY = "on-chain-chat-standalone-wallet";

// ============ Standalone Wallet (In-App Mode) ============

export interface StandaloneWallet {
  privateKey: string;
  address: string;
  createdAt: number;
}

/**
 * Get or create a standalone in-app wallet (not tied to a browser wallet).
 * This is used when users don't have MetaMask and want to use the app directly.
 */
export function getOrCreateStandaloneWallet(): ethers.Wallet {
  const stored = getStoredStandaloneWallet();
  if (stored) {
    return new ethers.Wallet(stored.privateKey);
  }

  const wallet = ethers.Wallet.createRandom();
  saveStandaloneWallet(wallet);
  return wallet;
}

/**
 * Get stored standalone wallet info
 */
export function getStoredStandaloneWallet(): StandaloneWallet | null {
  const data = localStorage.getItem(STANDALONE_STORAGE_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data) as StandaloneWallet;
  } catch {
    return null;
  }
}

/**
 * Save standalone wallet to localStorage
 */
export function saveStandaloneWallet(wallet: ethers.Wallet): void {
  const data: StandaloneWallet = {
    privateKey: wallet.privateKey,
    address: wallet.address,
    createdAt: Date.now(),
  };
  localStorage.setItem(STANDALONE_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Clear the standalone wallet from localStorage
 */
export function clearStandaloneWallet(): void {
  localStorage.removeItem(STANDALONE_STORAGE_KEY);
}

/**
 * Get the private key for export (with warning - user should be informed this is sensitive)
 */
export function getPrivateKeyForExport(): string | null {
  const stored = getStoredStandaloneWallet();
  return stored?.privateKey ?? null;
}

/**
 * Check if a standalone wallet exists
 */
export function hasStandaloneWallet(): boolean {
  return getStoredStandaloneWallet() !== null;
}

/**
 * Get standalone wallet address if it exists
 */
export function getStandaloneWalletAddress(): string | null {
  const stored = getStoredStandaloneWallet();
  return stored?.address ?? null;
}

/**
 * Connect standalone wallet to a provider
 */
export function getConnectedStandaloneWallet(provider: ethers.Provider): ethers.Wallet | null {
  const stored = getStoredStandaloneWallet();
  if (!stored) return null;

  const wallet = new ethers.Wallet(stored.privateKey);
  return wallet.connect(provider);
}

// ============ Delegate Wallet (Browser Wallet Mode) ============

/**
 * Get or create an app wallet (delegate wallet for gasless UX).
 * If a wallet exists for the given user address, returns it.
 * Otherwise creates a new random wallet.
 */
export function getOrCreateAppWallet(forUserAddress: string): ethers.Wallet {
  const stored = getStoredWalletInfo();

  // If we have a stored wallet for this user, use it
  if (stored && stored.authorizedFor.toLowerCase() === forUserAddress.toLowerCase()) {
    return new ethers.Wallet(stored.privateKey);
  }

  // Create a new random wallet - use the private key to ensure Wallet type
  const hdWallet = ethers.Wallet.createRandom();
  return new ethers.Wallet(hdWallet.privateKey);
}

/**
 * Save the app wallet to localStorage
 */
export function saveAppWallet(wallet: ethers.Wallet, authorizedFor: string): void {
  const data: StoredWallet = {
    privateKey: wallet.privateKey,
    address: wallet.address,
    authorizedFor: authorizedFor.toLowerCase(),
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Get stored wallet info without creating the wallet object
 */
export function getStoredWalletInfo(): StoredWallet | null {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data) as StoredWallet;
  } catch {
    return null;
  }
}

/**
 * Clear the stored app wallet
 */
export function clearAppWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if the stored wallet is authorized for a specific user
 */
export function isWalletAuthorizedFor(userAddress: string): boolean {
  const stored = getStoredWalletInfo();
  return stored?.authorizedFor.toLowerCase() === userAddress.toLowerCase();
}

/**
 * Get the app wallet address if it exists
 */
export function getAppWalletAddress(): string | null {
  const stored = getStoredWalletInfo();
  return stored?.address ?? null;
}

/**
 * Connect the app wallet to a provider
 */
export function getConnectedAppWallet(
  forUserAddress: string,
  provider: ethers.Provider
): ethers.Wallet {
  const wallet = getOrCreateAppWallet(forUserAddress);
  return wallet.connect(provider);
}
