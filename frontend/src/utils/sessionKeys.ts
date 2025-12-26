/**
 * Session Key Management
 *
 * Manages ECDH session keys for encrypted DMs.
 * Keys are stored in localStorage and are separate from the in-app wallet.
 *
 * Key rotation strategy:
 * 1. Generate new key pair periodically (or on demand)
 * 2. New key stored as `pendingKey`, old key stays as `currentKey`
 * 3. When counterparty sends message encrypted with `pendingKey`, promote it to `currentKey`
 * 4. Move old `currentKey` to `oldKeys` array for decrypting historical messages
 */

import {
  generateKeyPair,
  bytesToHex,
  hexToBytes,
} from "./crypto";

// ============ Types ============

interface StoredKey {
  privateKey: string; // hex
  publicKey: string; // hex
  createdAt: number; // timestamp
}

interface RetiredKey extends StoredKey {
  retiredAt: number; // timestamp
}

export interface SessionKeyStore {
  currentKey: StoredKey | null;
  pendingKey: StoredKey | null;
  oldKeys: RetiredKey[];
}

// ============ Constants ============

const STORAGE_KEY = "plaza_session_keys";
const MAX_OLD_KEYS = 10; // Keep last 10 retired keys

// ============ Storage Functions ============

/**
 * Load session keys from localStorage
 */
export function loadSessionKeys(): SessionKeyStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as SessionKeyStore;
    }
  } catch (e) {
    console.error("Failed to load session keys:", e);
  }

  return {
    currentKey: null,
    pendingKey: null,
    oldKeys: [],
  };
}

/**
 * Save session keys to localStorage
 */
function saveSessionKeys(store: SessionKeyStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error("Failed to save session keys:", e);
  }
}

// ============ Key Management ============

/**
 * Generate a new session key pair
 * If there's already a current key, it becomes pending
 */
export function generateSessionKey(): StoredKey {
  const keyPair = generateKeyPair();
  const now = Date.now();

  return {
    privateKey: bytesToHex(keyPair.privateKey),
    publicKey: bytesToHex(keyPair.publicKey),
    createdAt: now,
  };
}

/**
 * Get the current session key, or generate one if none exists
 */
export function getCurrentSessionKey(): StoredKey {
  const store = loadSessionKeys();

  if (!store.currentKey) {
    store.currentKey = generateSessionKey();
    saveSessionKeys(store);
  }

  return store.currentKey;
}

/**
 * Get the current public key as bytes (for on-chain storage)
 * Returns 64-byte public key without 0x04 prefix
 */
export function getCurrentPublicKeyBytes(): Uint8Array {
  const key = getCurrentSessionKey();
  return hexToBytes(key.publicKey);
}

/**
 * Get the current public key as hex (without 0x prefix for display)
 */
export function getCurrentPublicKeyHex(): string {
  const key = getCurrentSessionKey();
  return key.publicKey;
}

/**
 * Get the private key for deriving shared secrets
 */
export function getCurrentPrivateKeyBytes(): Uint8Array {
  const key = getCurrentSessionKey();
  return hexToBytes(key.privateKey);
}

/**
 * Start key rotation by generating a pending key
 * The pending key won't become current until acknowledged
 */
export function startKeyRotation(): StoredKey {
  const store = loadSessionKeys();

  if (!store.currentKey) {
    // No current key, just generate one
    store.currentKey = generateSessionKey();
    saveSessionKeys(store);
    return store.currentKey;
  }

  // Generate new pending key
  store.pendingKey = generateSessionKey();
  saveSessionKeys(store);

  return store.pendingKey;
}

/**
 * Check if there's a pending key waiting to be promoted
 */
export function hasPendingKey(): boolean {
  const store = loadSessionKeys();
  return store.pendingKey !== null;
}

/**
 * Get the pending key (if any)
 */
export function getPendingKey(): StoredKey | null {
  const store = loadSessionKeys();
  return store.pendingKey;
}

/**
 * Acknowledge the pending key (promote it to current)
 * Called when counterparty sends a message encrypted with the pending key
 */
export function acknowledgePendingKey(): void {
  const store = loadSessionKeys();

  if (!store.pendingKey) {
    return; // No pending key to acknowledge
  }

  if (store.currentKey) {
    // Retire the current key
    const retired: RetiredKey = {
      ...store.currentKey,
      retiredAt: Date.now(),
    };
    store.oldKeys.unshift(retired);

    // Limit old keys
    if (store.oldKeys.length > MAX_OLD_KEYS) {
      store.oldKeys = store.oldKeys.slice(0, MAX_OLD_KEYS);
    }
  }

  // Promote pending to current
  store.currentKey = store.pendingKey;
  store.pendingKey = null;

  saveSessionKeys(store);
}

/**
 * Cancel pending key rotation
 */
export function cancelPendingKey(): void {
  const store = loadSessionKeys();
  store.pendingKey = null;
  saveSessionKeys(store);
}

/**
 * Get all keys (current + pending + old) for attempting decryption
 * Returns in order: current, pending, old (newest first)
 */
export function getAllPrivateKeys(): Uint8Array[] {
  const store = loadSessionKeys();
  const keys: Uint8Array[] = [];

  if (store.currentKey) {
    keys.push(hexToBytes(store.currentKey.privateKey));
  }

  if (store.pendingKey) {
    keys.push(hexToBytes(store.pendingKey.privateKey));
  }

  for (const oldKey of store.oldKeys) {
    keys.push(hexToBytes(oldKey.privateKey));
  }

  return keys;
}

/**
 * Check if a given public key matches any of our keys
 * Used to detect if a message was encrypted with our pending key
 */
export function matchesOurKey(theirEncryptionKey: string): "current" | "pending" | "old" | null {
  const store = loadSessionKeys();

  // Normalize for comparison
  const normalizedInput = theirEncryptionKey.toLowerCase().replace(/^0x/, "");

  if (store.currentKey) {
    const currentNorm = store.currentKey.publicKey.toLowerCase().replace(/^0x/, "");
    if (currentNorm === normalizedInput) {
      return "current";
    }
  }

  if (store.pendingKey) {
    const pendingNorm = store.pendingKey.publicKey.toLowerCase().replace(/^0x/, "");
    if (pendingNorm === normalizedInput) {
      return "pending";
    }
  }

  for (const oldKey of store.oldKeys) {
    const oldNorm = oldKey.publicKey.toLowerCase().replace(/^0x/, "");
    if (oldNorm === normalizedInput) {
      return "old";
    }
  }

  return null;
}

/**
 * Get the private key for a specific public key
 * Used when we know which key was used for encryption
 */
export function getPrivateKeyFor(publicKeyHex: string): Uint8Array | null {
  const store = loadSessionKeys();
  const normalized = publicKeyHex.toLowerCase().replace(/^0x/, "");

  if (store.currentKey) {
    const currentNorm = store.currentKey.publicKey.toLowerCase().replace(/^0x/, "");
    if (currentNorm === normalized) {
      return hexToBytes(store.currentKey.privateKey);
    }
  }

  if (store.pendingKey) {
    const pendingNorm = store.pendingKey.publicKey.toLowerCase().replace(/^0x/, "");
    if (pendingNorm === normalized) {
      return hexToBytes(store.pendingKey.privateKey);
    }
  }

  for (const oldKey of store.oldKeys) {
    const oldNorm = oldKey.publicKey.toLowerCase().replace(/^0x/, "");
    if (oldNorm === normalized) {
      return hexToBytes(oldKey.privateKey);
    }
  }

  return null;
}

/**
 * Check if session keys are initialized
 */
export function hasSessionKey(): boolean {
  const store = loadSessionKeys();
  return store.currentKey !== null;
}

/**
 * Clear all session keys (for logout/reset)
 */
export function clearSessionKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get key age in days
 */
export function getKeyAgeDays(): number {
  const store = loadSessionKeys();
  if (!store.currentKey) {
    return 0;
  }
  return (Date.now() - store.currentKey.createdAt) / (1000 * 60 * 60 * 24);
}

/**
 * Check if key rotation is recommended (e.g., key is older than 7 days)
 */
export function shouldRotateKey(maxAgeDays: number = 7): boolean {
  return getKeyAgeDays() > maxAgeDays;
}
