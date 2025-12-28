import { useState, useCallback } from 'react';
import { truncateAddress } from '../../utils/formatters';
import type { AddressDisplayProps } from './types';

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
};

const colorVariants = {
  accent: 'text-accent-400 hover:text-accent-300',
  muted: 'text-primary-600 hover:text-primary-500',
};

export function AddressDisplay({
  address,
  displayName,
  showBoth = false,
  size = 'sm',
  className = '',
  variant = 'accent',
}: AddressDisplayProps & { variant?: 'accent' | 'muted' }) {
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
          ${colorVariants[variant]}
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
