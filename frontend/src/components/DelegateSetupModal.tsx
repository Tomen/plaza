import { useState } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { truncateAddress, formatBalance } from '../utils/formatters';

interface DelegateSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  appWalletAddress: string | null;
  currentBalance: bigint;
  isAuthorized: boolean;
  onAuthorize: () => Promise<void>;
  onFund: (amount: bigint) => Promise<void>;
}

const SUGGESTED_AMOUNTS = [
  { label: '0.01 PAS', value: ethers.parseEther('0.01') },
  { label: '0.05 PAS', value: ethers.parseEther('0.05') },
  { label: '0.1 PAS', value: ethers.parseEther('0.1') },
];

export function DelegateSetupModal({
  isOpen,
  onClose,
  appWalletAddress,
  currentBalance,
  isAuthorized,
  onAuthorize,
  onFund,
}: DelegateSetupModalProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  if (!isOpen || !appWalletAddress) return null;

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    const toastId = toast.loading('Authorizing session wallet...');

    try {
      await onAuthorize();
      toast.success('Session wallet authorized!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authorization failed', { id: toastId });
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleFund = async (amount: bigint) => {
    setIsFunding(true);
    const toastId = toast.loading('Funding session wallet...');

    try {
      await onFund(amount);
      toast.success('Session wallet funded!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Funding failed', { id: toastId });
    } finally {
      setIsFunding(false);
    }
  };

  const handleCustomFund = async () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    await handleFund(ethers.parseEther(customAmount));
    setCustomAmount('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 border-2 border-orange-500 bg-black p-6">
        <h2 className="text-xl font-bold text-orange-500 text-shadow-neon mb-4 font-mono">
          ▄▄▄ SESSION WALLET SETUP ▄▄▄
        </h2>

        <div className="space-y-6">
          {/* Session wallet info */}
          <div className="border border-orange-700 p-4">
            <div className="font-mono text-sm">
              <div className="flex justify-between text-orange-400 mb-2">
                <span>SESSION ADDRESS:</span>
                <span className="text-cyan-400">{truncateAddress(appWalletAddress)}</span>
              </div>
              <div className="flex justify-between text-orange-400">
                <span>BALANCE:</span>
                <span className="text-cyan-400">{formatBalance(currentBalance)} PAS</span>
              </div>
            </div>
          </div>

          {/* Step 1: Authorize */}
          <div className={`border p-4 ${isAuthorized ? 'border-green-700' : 'border-orange-700'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm text-orange-400">
                STEP 1: AUTHORIZE SESSION WALLET
              </span>
              {isAuthorized && (
                <span className="text-green-500 font-mono text-xs">COMPLETE</span>
              )}
            </div>
            <p className="text-xs text-orange-600 font-mono mb-3">
              Authorize this wallet to post messages on your behalf. This allows gasless
              messaging without MetaMask popups for each message.
            </p>
            <button
              onClick={handleAuthorize}
              disabled={isAuthorizing || isAuthorized}
              className="w-full py-2 bg-orange-900 hover:bg-orange-800 text-orange-400 border-2 border-orange-500 font-mono text-sm disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
            >
              {isAuthorizing ? 'AUTHORIZING...' : isAuthorized ? 'AUTHORIZED' : 'AUTHORIZE'}
            </button>
          </div>

          {/* Step 2: Fund */}
          <div className="border border-orange-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm text-orange-400">
                STEP 2: FUND SESSION WALLET
              </span>
            </div>
            <p className="text-xs text-orange-600 font-mono mb-3">
              Send some PAS to cover transaction fees for posting messages.
            </p>

            <div className="flex gap-2 mb-3">
              {SUGGESTED_AMOUNTS.map((amt) => (
                <button
                  key={amt.label}
                  onClick={() => handleFund(amt.value)}
                  disabled={isFunding}
                  className="flex-1 py-2 bg-cyan-900 hover:bg-cyan-800 text-cyan-400 border border-cyan-500 font-mono text-xs disabled:opacity-50"
                >
                  {amt.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Custom amount"
                disabled={isFunding}
                className="flex-1 px-3 py-2 bg-black border border-orange-500 text-orange-400 font-mono text-sm focus:outline-none"
              />
              <button
                onClick={handleCustomFund}
                disabled={isFunding || !customAmount}
                className="px-4 py-2 bg-orange-900 hover:bg-orange-800 text-orange-400 border border-orange-500 font-mono text-sm disabled:opacity-50"
              >
                SEND
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full py-2 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
