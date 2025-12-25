import { useState } from 'react';
import toast from 'react-hot-toast';
import { truncateAddress } from '../utils/formatters';

interface LinkBrowserWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  inAppAddress: string;
  browserAddress: string;
  onAddAsDelegate: () => Promise<void>;
  onTransferOwnership: () => Promise<void>;
}

export function LinkBrowserWalletModal({
  isOpen,
  onClose,
  inAppAddress,
  browserAddress,
  onAddAsDelegate,
  onTransferOwnership,
}: LinkBrowserWalletModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [action, setAction] = useState<'delegate' | 'transfer' | null>(null);

  if (!isOpen) return null;

  const handleAddAsDelegate = async () => {
    setIsProcessing(true);
    setAction('delegate');
    const toastId = toast.loading('Adding browser wallet as delegate...');

    try {
      await onAddAsDelegate();
      toast.success('Browser wallet added as delegate!', { id: toastId });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add delegate', { id: toastId });
    } finally {
      setIsProcessing(false);
      setAction(null);
    }
  };

  const handleTransferOwnership = async () => {
    setIsProcessing(true);
    setAction('transfer');
    const toastId = toast.loading('Transferring profile ownership...');

    try {
      await onTransferOwnership();
      toast.success('Profile ownership transferred!', { id: toastId });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer ownership', { id: toastId });
    } finally {
      setIsProcessing(false);
      setAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-80"
        onClick={isProcessing ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 border-2 border-cyan-500 bg-black p-6">
        <h2 className="text-xl font-bold text-cyan-500 text-shadow-neon mb-2 font-mono text-center">
          ▄▄▄ LINK BROWSER WALLET ▄▄▄
        </h2>
        <p className="text-cyan-600 font-mono text-sm text-center mb-6">
          Browser wallet connected! Choose how to link it.
        </p>

        {/* Wallet Info */}
        <div className="mb-4 p-3 border border-cyan-700 bg-cyan-950 bg-opacity-20">
          <div className="font-mono text-xs space-y-1">
            <p className="text-cyan-600">
              <span className="text-cyan-400">IN-APP:</span> {truncateAddress(inAppAddress)}
            </p>
            <p className="text-cyan-600">
              <span className="text-cyan-400">BROWSER:</span> {truncateAddress(browserAddress)}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-6">
          {/* Option 1: Add as Delegate */}
          <button
            onClick={handleAddAsDelegate}
            disabled={isProcessing}
            className={`w-full p-4 border-2 text-left transition-all ${
              isProcessing
                ? 'border-gray-700 opacity-50'
                : 'border-orange-500 hover:bg-orange-950 hover:bg-opacity-30'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl">👥</div>
              <div className="flex-1">
                <h3 className="font-mono font-bold text-orange-400">
                  ADD AS DELEGATE
                </h3>
                <p className="font-mono text-xs text-orange-600 mt-1">
                  Browser wallet can post on behalf of your in-app profile. Your profile stays with the in-app wallet.
                </p>
              </div>
              {action === 'delegate' && (
                <div className="text-orange-400 font-mono text-sm animate-pulse">...</div>
              )}
            </div>
          </button>

          {/* Option 2: Transfer Ownership (Recommended) */}
          <button
            onClick={handleTransferOwnership}
            disabled={isProcessing}
            className={`w-full p-4 border-2 text-left transition-all ${
              isProcessing
                ? 'border-gray-700 opacity-50'
                : 'border-green-500 hover:bg-green-950 hover:bg-opacity-30'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔄</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono font-bold text-green-400">
                    TRANSFER OWNERSHIP
                  </h3>
                  <span className="px-2 py-0.5 bg-green-900 text-green-400 font-mono text-xs border border-green-500">
                    RECOMMENDED
                  </span>
                </div>
                <p className="font-mono text-xs text-green-600 mt-1">
                  Move your profile to the browser wallet. More secure for long-term use. In-app wallet will become a delegate.
                </p>
              </div>
              {action === 'transfer' && (
                <div className="text-green-400 font-mono text-sm animate-pulse">...</div>
              )}
            </div>
          </button>
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="w-full py-2 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 disabled:opacity-50"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
