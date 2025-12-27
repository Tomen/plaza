import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { truncateAddress } from '../utils/formatters';

interface LinkBrowserWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  inAppAddress: string;
  browserAddress: string;
  inAppHasProfile: boolean;
  checkBrowserHasProfile: () => Promise<boolean>;
  onAddAsDelegate: () => Promise<void>;
  onTransferOwnership: () => Promise<void>;
  onSwitchToBrowser: () => void;
}

export function LinkBrowserWalletModal({
  isOpen,
  onClose,
  inAppAddress,
  browserAddress,
  inAppHasProfile,
  checkBrowserHasProfile,
  onAddAsDelegate,
  onTransferOwnership,
  onSwitchToBrowser,
}: LinkBrowserWalletModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [action, setAction] = useState<'delegate' | 'transfer' | 'switch' | null>(null);
  const [browserHasProfile, setBrowserHasProfile] = useState<boolean | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  // Check if browser wallet has a profile when modal opens
  useEffect(() => {
    if (isOpen && browserAddress) {
      setIsCheckingProfile(true);
      setConfirmAbandon(false);
      checkBrowserHasProfile()
        .then(setBrowserHasProfile)
        .catch(() => setBrowserHasProfile(false))
        .finally(() => setIsCheckingProfile(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, browserAddress]); // Intentionally exclude checkBrowserHasProfile to prevent re-renders

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

  const handleSwitchToBrowser = () => {
    setAction('switch');
    toast.success('Switched to browser wallet!');
    onSwitchToBrowser();
  };

  // Determine which scenario we're in (treat null as false while checking)
  const showTransferOption = inAppHasProfile && browserHasProfile === false;
  const showSwitchOption = browserHasProfile === true || !inAppHasProfile;
  const needsAbandonConfirm = browserHasProfile === true && inAppHasProfile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-80"
        onClick={isProcessing ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 border-2 border-accent-500 bg-black p-6">
        <h2 className="text-xl font-bold text-accent-500 text-shadow-neon mb-2 font-mono text-center">
          ▄▄▄ LINK BROWSER WALLET ▄▄▄
        </h2>
        <p className="text-accent-600 font-mono text-sm text-center mb-6">
          Browser wallet connected! Choose how to link it.
        </p>

        {/* Wallet Info */}
        <div className="mb-4 p-3 border border-accent-700 bg-accent-950 bg-opacity-20">
          <div className="font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-accent-400">SESSION:</span>
              <span className="text-accent-600">
                {truncateAddress(inAppAddress)}
                {inAppHasProfile && <span className="text-green-500 ml-2">has profile</span>}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-accent-400">BROWSER:</span>
              <span className="text-accent-600">
                {truncateAddress(browserAddress)}
                {isCheckingProfile ? (
                  <span className="text-gray-500 ml-2">checking...</span>
                ) : browserHasProfile ? (
                  <span className="text-green-500 ml-2">has profile</span>
                ) : null}
              </span>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isCheckingProfile && (
          <div className="text-center py-4 text-accent-600 font-mono text-sm">
            Checking profile status...
          </div>
        )}

        {/* Options - only show when done checking */}
        {!isCheckingProfile && (
          <div className="space-y-4 mb-6">
            {/* Warning when both have profiles */}
            {needsAbandonConfirm && (
              <div className="p-3 border border-yellow-600 bg-yellow-950 bg-opacity-20">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-500 text-lg">!</span>
                  <div className="font-mono text-xs text-yellow-600">
                    <p className="font-bold text-yellow-500 mb-1">Both wallets have profiles!</p>
                    <p>Your browser wallet already has a profile. If you switch, your session account profile will be abandoned (it stays on-chain but won't be used).</p>
                  </div>
                </div>
              </div>
            )}

            {/* Option: Switch to Browser Wallet */}
            {showSwitchOption && (
              <div className={`w-full p-4 border-2 text-left transition-all ${
                isProcessing
                  ? 'border-gray-700 opacity-50'
                  : 'border-accent-500 hover:bg-accent-950 hover:bg-opacity-30'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🔀</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-accent-400">
                        SWITCH TO BROWSER WALLET
                      </h3>
                      {!needsAbandonConfirm && (
                        <span className="px-2 py-0.5 bg-accent-900 text-accent-400 font-mono text-xs border border-accent-500">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-accent-600 mt-1">
                      {browserHasProfile
                        ? 'Use your existing browser wallet profile. More secure for long-term use.'
                        : 'Switch to browser wallet mode. You can create a profile there.'}
                    </p>
                    {needsAbandonConfirm && (
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmAbandon}
                          onChange={(e) => setConfirmAbandon(e.target.checked)}
                          className="w-4 h-4 accent-yellow-500"
                        />
                        <span className="font-mono text-xs text-yellow-500">
                          I understand my session account profile will be abandoned
                        </span>
                      </label>
                    )}
                    <button
                      onClick={handleSwitchToBrowser}
                      disabled={isProcessing || (needsAbandonConfirm === true && !confirmAbandon)}
                      className="mt-3 px-4 py-2 bg-accent-900 hover:bg-accent-800 text-accent-400 border-2 border-accent-500 hover:border-accent-400 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                    >
                      {action === 'switch' ? '...' : 'SWITCH'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Option: Transfer Ownership (only when browser has no profile) */}
            {showTransferOption && (
              <button
                onClick={handleTransferOwnership}
                disabled={isProcessing}
                className={`w-full p-4 border-2 text-left transition-all ${
                  isProcessing
                    ? 'bg-gray-900 border-gray-700 opacity-70'
                    : 'bg-green-950 bg-opacity-20 border-green-500 hover:bg-green-950 hover:bg-opacity-40'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🔄</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-green-400">
                        TRANSFER OWNERSHIP
                      </h3>
                      <span className="px-2 py-0.5 bg-green-900 text-green-400 font-mono text-xs border-2 border-green-500">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="font-mono text-xs text-green-600 mt-1">
                      Move your profile to the browser wallet. More secure for long-term use. Session account will become a delegate.
                    </p>
                  </div>
                  {action === 'transfer' && (
                    <div className="text-green-400 font-mono text-sm animate-pulse">...</div>
                  )}
                </div>
              </button>
            )}

            {/* Option: Add as Delegate (always available when in-app has profile) */}
            {inAppHasProfile && (
              <button
                onClick={handleAddAsDelegate}
                disabled={isProcessing}
                className={`w-full p-4 border-2 text-left transition-all ${
                  isProcessing
                    ? 'bg-gray-900 border-gray-700 opacity-70'
                    : 'bg-primary-950 bg-opacity-20 border-primary-500 hover:bg-primary-950 hover:bg-opacity-40'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">👥</div>
                  <div className="flex-1">
                    <h3 className="font-mono font-bold text-primary-400">
                      ADD AS DELEGATE
                    </h3>
                    <p className="font-mono text-xs text-primary-600 mt-1">
                      Browser wallet can post on behalf of your session account profile. Both profiles continue to exist separately.
                    </p>
                  </div>
                  {action === 'delegate' && (
                    <div className="text-primary-400 font-mono text-sm animate-pulse">...</div>
                  )}
                </div>
              </button>
            )}
          </div>
        )}

        {/* Cancel button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="w-full py-2 bg-gray-900 hover:bg-gray-800 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
