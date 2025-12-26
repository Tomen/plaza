import { useState, useCallback, useEffect } from "react";
import {
  getCurrentSessionKey,
  getCurrentPublicKeyBytes,
  startKeyRotation,
  hasPendingKey,
  acknowledgePendingKey,
  cancelPendingKey,
  hasSessionKey,
  clearSessionKeys,
  getKeyAgeDays,
  shouldRotateKey,
} from "../utils/sessionKeys";

interface UseSessionKeysProps {
  setSessionPublicKeyOnChain: (pubKey: Uint8Array) => Promise<void>;
  clearSessionPublicKeyOnChain: () => Promise<void>;
  getOnChainPublicKey: () => Promise<string>;
  enabled?: boolean;
}

interface UseSessionKeysReturn {
  // State
  hasLocalKey: boolean;
  hasPendingRotation: boolean;
  keyAgeDays: number;
  needsRotation: boolean;
  isPublishing: boolean;
  error: string | null;

  // Actions
  initializeSessionKey: () => Promise<void>;
  rotateSessionKey: () => Promise<void>;
  confirmPendingKey: () => void;
  cancelRotation: () => void;
  syncWithChain: () => Promise<void>;
  clearAllKeys: () => Promise<void>;

  // Getters
  getCurrentPublicKey: () => Uint8Array | null;
}

export function useSessionKeys({
  setSessionPublicKeyOnChain,
  clearSessionPublicKeyOnChain,
  getOnChainPublicKey,
  enabled = true,
}: UseSessionKeysProps): UseSessionKeysReturn {
  const [hasLocalKey, setHasLocalKey] = useState(false);
  const [hasPendingRotation, setHasPendingRotation] = useState(false);
  const [keyAgeDays, setKeyAgeDays] = useState(0);
  const [needsRotation, setNeedsRotation] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh local state from storage
  const refreshState = useCallback(() => {
    setHasLocalKey(hasSessionKey());
    setHasPendingRotation(hasPendingKey());
    setKeyAgeDays(getKeyAgeDays());
    setNeedsRotation(shouldRotateKey());
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Initialize session key (generate if needed, publish to chain)
  const initializeSessionKey = useCallback(async () => {
    if (!enabled) throw new Error("Not enabled");

    setIsPublishing(true);
    setError(null);

    try {
      // Get or generate session key
      getCurrentSessionKey();
      const pubKeyBytes = getCurrentPublicKeyBytes();

      // Publish to chain
      await setSessionPublicKeyOnChain(pubKeyBytes);

      refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize session key");
      throw err;
    } finally {
      setIsPublishing(false);
    }
  }, [enabled, setSessionPublicKeyOnChain, refreshState]);

  // Start key rotation (generate pending key)
  const rotateSessionKey = useCallback(async () => {
    if (!enabled) throw new Error("Not enabled");

    setIsPublishing(true);
    setError(null);

    try {
      // Generate new pending key
      const newKey = startKeyRotation();

      // Publish the new pending key to chain
      // Note: The pending key becomes "current" on-chain immediately,
      // but locally we wait for acknowledgment before promoting it
      const pubKeyBytes = new Uint8Array(
        newKey.publicKey.replace(/^0x/, "").match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
      );

      await setSessionPublicKeyOnChain(pubKeyBytes);

      refreshState();
    } catch (err) {
      // Cancel pending key if publishing failed
      cancelPendingKey();
      setError(err instanceof Error ? err.message : "Failed to rotate session key");
      throw err;
    } finally {
      setIsPublishing(false);
    }
  }, [enabled, setSessionPublicKeyOnChain, refreshState]);

  // Confirm pending key (called when counterparty acknowledges)
  const confirmPendingKey = useCallback(() => {
    acknowledgePendingKey();
    refreshState();
  }, [refreshState]);

  // Cancel pending rotation
  const cancelRotation = useCallback(() => {
    cancelPendingKey();
    refreshState();
  }, [refreshState]);

  // Sync local key with on-chain key
  const syncWithChain = useCallback(async () => {
    if (!enabled) return;

    try {
      const onChainKey = await getOnChainPublicKey();
      const localKey = hasSessionKey() ? getCurrentSessionKey() : null;

      if (!onChainKey || onChainKey === "0x") {
        // No key on-chain, need to publish
        if (localKey) {
          // We have a local key, publish it
          await initializeSessionKey();
        }
      } else if (!localKey) {
        // Key on-chain but not locally - this is a problem
        // User may have switched browsers or cleared storage
        console.warn("Session key exists on-chain but not locally. Need to regenerate.");
        // Generate new key and publish
        await initializeSessionKey();
      }
      // If both exist, assume they're in sync (user manages rotation)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync with chain");
    }
  }, [enabled, getOnChainPublicKey, initializeSessionKey]);

  // Clear all keys (for logout/reset)
  const clearAllKeys = useCallback(async () => {
    if (!enabled) throw new Error("Not enabled");

    setIsPublishing(true);
    setError(null);

    try {
      await clearSessionPublicKeyOnChain();
      clearSessionKeys();
      refreshState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear session keys");
      throw err;
    } finally {
      setIsPublishing(false);
    }
  }, [enabled, clearSessionPublicKeyOnChain, refreshState]);

  // Get current public key bytes
  const getCurrentPublicKey = useCallback((): Uint8Array | null => {
    if (!hasSessionKey()) return null;
    return getCurrentPublicKeyBytes();
  }, []);

  return {
    hasLocalKey,
    hasPendingRotation,
    keyAgeDays,
    needsRotation,
    isPublishing,
    error,
    initializeSessionKey,
    rotateSessionKey,
    confirmPendingKey,
    cancelRotation,
    syncWithChain,
    clearAllKeys,
    getCurrentPublicKey,
  };
}
