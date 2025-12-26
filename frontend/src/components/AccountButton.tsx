import { truncateAddress, getFuelEmoji } from '../utils/formatters';
import type { WalletMode } from '../hooks/useAppWallet';

interface AccountButtonProps {
  // Wallet state
  walletAddress: string | null;
  isConnecting: boolean;
  onConnect: () => void;

  // Profile state
  profileName: string | null;
  hasProfile: boolean;

  // In-app wallet state
  isAuthorized: boolean;
  balance: bigint;

  // Modal control
  onOpenAccount: () => void;

  // Wallet mode
  walletMode?: WalletMode;
}

export function AccountButton({
  walletAddress,
  isConnecting,
  onConnect,
  profileName,
  hasProfile,
  isAuthorized: _isAuthorized,
  balance,
  onOpenAccount,
  walletMode = 'none',
}: AccountButtonProps) {
  void _isAuthorized; // Reserved for future use
  // Determine button state and display
  const isConnected = !!walletAddress;
  const isInAppMode = walletMode === 'standalone';
  const displayText = hasProfile && profileName
    ? profileName
    : isConnected
      ? truncateAddress(walletAddress!)
      : 'CONNECT WALLET';
  const showFuelIcon = isConnected && isInAppMode;
  const fuelEmoji = showFuelIcon ? getFuelEmoji(balance) : '';

  // Button click handler
  const handleClick = () => {
    if (!isConnected) {
      onConnect();
    } else {
      onOpenAccount();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className="bg-primary-900 hover:bg-primary-800 disabled:bg-gray-800 disabled:text-gray-600 text-primary-400 font-mono text-sm py-2 px-6 border-2 border-primary-500 hover:border-primary-400 disabled:border-gray-700 transition-all duration-200 border-shadow-neon disabled:shadow-none"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <span className="terminal-cursor">█</span>
          CONNECTING...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className={isConnected ? 'text-accent-400' : 'text-red-500'}>
            {isConnected ? '●' : '○'}
          </span>
          {isInAppMode && <span className="text-yellow-500">🔐</span>}
          {displayText}
          {showFuelIcon && <span>{fuelEmoji}</span>}
        </span>
      )}
    </button>
  );
}
