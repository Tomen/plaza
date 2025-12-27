import { useState, useCallback } from 'react';
import { truncateAddress } from '../../utils/formatters';
import type { AddressDisplayProps } from './types';

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
};

export function AddressDisplay({
  address,
  displayName,
  showBoth = false,
  size = 'sm',
  className = '',
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [address]);

  const truncated = truncateAddress(address);

  // Single display mode (either name or address)
  if (!showBoth) {
    return (
      <button
        onClick={handleCopy}
        className={`
          font-mono ${sizeClasses[size]}
          text-accent-400 hover:text-accent-300
          transition-colors cursor-pointer
          ${className}
        `}
        title="Click to copy full address"
      >
        {copied ? '✓ Copied!' : (displayName || truncated)}
      </button>
    );
  }

  // Dual display mode (name + address)
  return (
    <div className={`font-mono ${className}`}>
      {displayName && (
        <div className={`${sizeClasses[size]} text-primary-400`}>
          {displayName}
        </div>
      )}
      <button
        onClick={handleCopy}
        className={`
          text-xs
          text-primary-700 hover:text-accent-400
          transition-colors cursor-pointer
        `}
        title="Click to copy full address"
      >
        {copied ? '✓ Copied!' : truncated}
      </button>
    </div>
  );
}
