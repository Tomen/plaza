import { truncateAddress, getFuelEmoji } from '../utils/formatters';

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
}

export function AccountButton({
  walletAddress,
  isConnecting,
  onConnect,
  profileName,
  hasProfile,
  isAuthorized,
  balance,
  onOpenAccount,
}: AccountButtonProps) {
  // Determine button state and display
  const isConnected = !!walletAddress;
  const displayText = hasProfile && profileName ? profileName : isConnected ? truncateAddress(walletAddress!) : 'CONNECT WALLET';
  const showFuelIcon = isConnected && hasProfile && isAuthorized;
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
      className="bg-orange-900 hover:bg-orange-800 disabled:bg-gray-800 disabled:text-gray-600 text-orange-400 font-mono text-sm py-2 px-6 border-2 border-orange-500 hover:border-orange-400 disabled:border-gray-700 transition-all duration-200 border-shadow-neon disabled:shadow-none"
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <span className="terminal-cursor">█</span>
          CONNECTING...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className={isConnected ? 'text-cyan-400' : 'text-red-500'}>
            {isConnected ? '●' : '○'}
          </span>
          {displayText}
          {showFuelIcon && <span>{fuelEmoji}</span>}
        </span>
      )}
    </button>
  );
}
