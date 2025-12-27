interface AccountButtonProps {
  walletAddress: string | null;
  isConnecting: boolean;
  onConnect: () => void;
}

export function AccountButton({
  walletAddress,
  isConnecting,
  onConnect,
}: AccountButtonProps) {
  const isConnected = !!walletAddress;

  // Don't render when connected - user accesses profile via sidebar
  if (isConnected) {
    return null;
  }

  return (
    <button
      onClick={onConnect}
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
          <span className="text-red-500">○</span>
          CONNECT
        </span>
      )}
    </button>
  );
}
