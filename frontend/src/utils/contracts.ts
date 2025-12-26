import { ethers } from 'ethers';

export type Provider = ethers.BrowserProvider | ethers.JsonRpcProvider;
export type Signer = ethers.Wallet | ethers.Signer;

/**
 * Creates a read-only contract instance
 */
export function createReadContract(
  address: string | null,
  abi: ethers.InterfaceAbi,
  provider: Provider | null
): ethers.Contract | null {
  if (!address || !provider) return null;
  return new ethers.Contract(address, abi, provider);
}

/**
 * Creates a contract instance for writing (with signer)
 * Handles both BrowserProvider (can get signer) and JsonRpcProvider (needs external signer)
 */
export async function createWriteContract(
  address: string | null,
  abi: ethers.InterfaceAbi,
  provider: Provider | null,
  externalSigner: Signer | null
): Promise<ethers.Contract | null> {
  if (!address) return null;

  // Prefer external signer (required for JsonRpcProvider / standalone mode)
  if (externalSigner) {
    // Connect wallet to provider if it's not already connected
    if (externalSigner instanceof ethers.Wallet && provider) {
      return new ethers.Contract(address, abi, externalSigner.connect(provider));
    }
    return new ethers.Contract(address, abi, externalSigner);
  }

  // Fall back to getting signer from provider (only works with BrowserProvider)
  if (!provider) return null;

  // Check if provider can give us a signer (BrowserProvider has getSigner, JsonRpcProvider doesn't)
  if (isBrowserProvider(provider)) {
    try {
      const signer = await provider.getSigner();
      return new ethers.Contract(address, abi, signer);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Type guard to check if provider is BrowserProvider (has getSigner method)
 */
export function isBrowserProvider(
  provider: Provider | null
): provider is ethers.BrowserProvider {
  if (!provider) return false;
  // BrowserProvider has getSigner method that returns a promise
  // JsonRpcProvider doesn't have getSigner as a callable method
  // Note: Don't use constructor.name as it gets mangled in production builds
  return 'getSigner' in provider &&
         typeof (provider as ethers.BrowserProvider).getSigner === 'function';
}
