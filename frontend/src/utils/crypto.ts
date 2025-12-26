/**
 * ECDH + AES-GCM Encryption Utilities
 *
 * Uses secp256k1 for key exchange and AES-256-GCM for symmetric encryption.
 * The shared secret is derived using ECDH, then hashed with SHA-256 for use as AES key.
 */

import * as secp256k1 from "@noble/secp256k1";
import { hexlify, getBytes } from "ethers";

// ============ Types ============

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

// ============ Key Generation ============

/**
 * Generate a new secp256k1 key pair for ECDH encryption
 * @returns KeyPair with 32-byte private key and 64-byte uncompressed public key (without 0x04 prefix)
 */
export function generateKeyPair(): KeyPair {
  const privateKey = secp256k1.utils.randomSecretKey();
  // getPublicKey returns 65 bytes (0x04 prefix + 64 bytes)
  const publicKeyFull = secp256k1.getPublicKey(privateKey, false);
  // Remove the 0x04 prefix, keeping only the 64-byte public key
  const publicKey = publicKeyFull.slice(1);

  return { privateKey, publicKey };
}

/**
 * Get the public key from a private key
 * @param privateKey 32-byte private key
 * @returns 64-byte uncompressed public key (without 0x04 prefix)
 */
export function getPublicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  const publicKeyFull = secp256k1.getPublicKey(privateKey, false);
  return publicKeyFull.slice(1);
}

// ============ ECDH Key Exchange ============

/**
 * Derive a shared secret using ECDH
 * The shared secret is deterministically derived from both parties' keys.
 * Alice: sharedSecret = ECDH(alice.privateKey, bob.publicKey)
 * Bob:   sharedSecret = ECDH(bob.privateKey, alice.publicKey)
 * Both derive the same shared secret.
 *
 * @param myPrivateKey My 32-byte private key
 * @param theirPublicKey Their 64-byte public key (without 0x04 prefix)
 * @returns 32-byte shared secret (SHA-256 hash of the ECDH point)
 */
export async function deriveSharedSecret(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<Uint8Array> {
  // Add 0x04 prefix for uncompressed point format
  const theirPublicKeyFull = new Uint8Array(65);
  theirPublicKeyFull[0] = 0x04;
  theirPublicKeyFull.set(theirPublicKey, 1);

  // ECDH: multiply my private key by their public key point
  // Returns 33 bytes (compressed point)
  const sharedPoint = secp256k1.getSharedSecret(myPrivateKey, theirPublicKeyFull);

  // Hash the shared point to get a 32-byte key suitable for AES-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(sharedPoint));
  return new Uint8Array(hashBuffer);
}

// ============ AES-GCM Encryption ============

const AES_KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes (96 bits, recommended for GCM)

/**
 * Helper to convert Uint8Array to ArrayBuffer for Web Crypto API
 * This handles the TypeScript strictness around ArrayBufferLike
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param sharedSecret 32-byte shared secret (from ECDH)
 * @param plaintext The message to encrypt
 * @returns Hex-encoded ciphertext (IV + encrypted data + auth tag)
 */
export async function encrypt(
  sharedSecret: Uint8Array,
  plaintext: string
): Promise<string> {
  // Import the shared secret as an AES key
  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(sharedSecret),
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt"]
  );

  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encode plaintext to bytes
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintextBytes
  );

  // Combine IV + ciphertext (ciphertext includes auth tag)
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  // Return as hex string
  return hexlify(combined);
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param sharedSecret 32-byte shared secret (from ECDH)
 * @param ciphertextHex Hex-encoded ciphertext (IV + encrypted data + auth tag)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(
  sharedSecret: Uint8Array,
  ciphertextHex: string
): Promise<string> {
  // Import the shared secret as an AES key
  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(sharedSecret),
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["decrypt"]
  );

  // Convert hex to bytes
  const combined = getBytes(ciphertextHex);

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  // Decode bytes to string
  return new TextDecoder().decode(plaintextBuffer);
}

// ============ Utility Functions ============

/**
 * Convert a hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  return getBytes(hex);
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return hexlify(bytes);
}

/**
 * Validate a public key
 * @param publicKey 64-byte public key (without 0x04 prefix)
 * @returns true if valid secp256k1 point
 */
export function isValidPublicKey(publicKey: Uint8Array): boolean {
  if (publicKey.length !== 64) {
    return false;
  }

  try {
    // Add 0x04 prefix and validate as a point on the curve
    const fullKey = new Uint8Array(65);
    fullKey[0] = 0x04;
    fullKey.set(publicKey, 1);
    return secp256k1.utils.isValidPublicKey(fullKey);
  } catch {
    return false;
  }
}
