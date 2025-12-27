import { useState } from 'react';
import toast from 'react-hot-toast';
import { formatEther } from 'ethers';

interface SessionAccountSetupProps {
  isOpen: boolean;
  walletAddress: string;
  balance: bigint;
  onContinue: () => void;
  onRefreshBalance: () => Promise<void>;
  onBack: () => void;
}

export function SessionAccountSetup({
  isOpen,
  walletAddress,
  balance,
  onContinue,
  onRefreshBalance,
  onBack,
}: SessionAccountSetupProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshBalance();
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasBalance = balance > 0n;
  const formattedBalance = formatEther(balance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-90" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 border-2 border-primary-500 bg-black p-6">
        <h2 className="text-xl font-bold text-primary-500 text-shadow-neon mb-2 font-mono text-center">
          ▄▄▄ SESSION ACCOUNT SETUP ▄▄▄
        </h2>
        <p className="text-primary-600 font-mono text-sm text-center mb-6">
          Your session account has been created!
        </p>

        {/* Wallet Address */}
        <div className="mb-4">
          <label className="block text-primary-400 font-mono text-xs mb-2">
            YOUR SESSION ACCOUNT ADDRESS
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-black border-2 border-primary-500 text-accent-400 font-mono text-sm break-all">
              {walletAddress}
            </div>
            <button
              onClick={handleCopyAddress}
              className="px-3 py-2 bg-primary-900 hover:bg-primary-800 border-2 border-primary-500 text-primary-400 font-mono text-sm transition-all"
            >
              {copied ? '✓' : 'COPY'}
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="mb-4">
          <label className="block text-primary-400 font-mono text-xs mb-2">
            BALANCE
          </label>
          <div className="flex items-center gap-2">
            <div className={`flex-1 px-3 py-2 bg-black border-2 font-mono text-sm ${
              hasBalance ? 'border-green-500 text-green-400' : 'border-yellow-500 text-yellow-400'
            }`}>
              {formattedBalance} PAS
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-primary-900 hover:bg-primary-800 border-2 border-primary-500 text-primary-400 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {isRefreshing ? '...' : 'REFRESH'}
            </button>
          </div>
        </div>

        {/* Faucet Instructions */}
        {!hasBalance && (
          <div className="mb-6 p-4 border border-accent-500 bg-accent-950 bg-opacity-20">
            <h3 className="text-accent-400 font-mono font-bold text-sm mb-2">
              STEP 1: GET TEST TOKENS
            </h3>
            <ol className="text-accent-600 font-mono text-xs space-y-2">
              <li>1. Copy your session account address above</li>
              <li>2. Visit the Polkadot Asset Hub faucet:
                <a
                  href="https://faucet.polkadot.io/?parachain=1111"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-400 hover:underline ml-1"
                >
                  faucet.polkadot.io
                </a>
              </li>
              <li>3. Paste your address and request tokens</li>
              <li>4. Click REFRESH above to check your balance</li>
            </ol>
          </div>
        )}

        {/* Warning */}
        <div className="mb-6 p-3 border border-yellow-700 bg-yellow-950 bg-opacity-20">
          <div className="flex items-start gap-2">
            <span className="text-yellow-500">!</span>
            <div className="font-mono text-xs text-yellow-600">
              <p><strong className="text-yellow-500">IMPORTANT:</strong> Your session account is stored in this browser. Clearing browser data will delete it.</p>
              <p className="mt-1">You can export your private key later from the settings menu.</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-2 bg-gray-900 hover:bg-gray-800 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 transition-all"
          >
            BACK
          </button>
          <button
            onClick={onContinue}
            disabled={!hasBalance}
            className={`flex-1 py-2 font-mono text-sm border-2 transition-all ${
              hasBalance
                ? 'bg-green-900 hover:bg-green-800 text-green-400 border-green-500 hover:border-green-400'
                : 'bg-gray-900 text-gray-600 border-gray-700 cursor-not-allowed opacity-70'
            }`}
          >
            {hasBalance ? 'CONTINUE' : 'FUND ACCOUNT FIRST'}
          </button>
        </div>
      </div>
    </div>
  );
}
