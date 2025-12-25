import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { truncateAddress, formatBalance, getFuelEmoji } from '../utils/formatters';
import type { Profile } from '../types/contracts';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;

  // Wallet
  walletAddress: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;

  // Profile
  profile: Profile | null;
  onCreateProfile: (name: string, bio: string) => Promise<void>;
  onUpdateProfile: (name: string, bio: string) => Promise<void>;

  // In-app wallet
  appWalletAddress: string | null;
  appWalletBalance: bigint;
  isAuthorized: boolean;
  onSetupAppWallet: () => Promise<void>;
  onTopUp: (amount: bigint) => Promise<void>;
}

const SUGGESTED_AMOUNTS = [
  { label: '0.01 PAS', value: ethers.parseEther('0.01') },
  { label: '0.05 PAS', value: ethers.parseEther('0.05') },
  { label: '0.1 PAS', value: ethers.parseEther('0.1') },
];

export function AccountModal({
  isOpen,
  onClose,
  walletAddress,
  isConnecting,
  onConnect,
  onDisconnect,
  profile,
  onCreateProfile,
  onUpdateProfile,
  appWalletAddress,
  appWalletBalance,
  isAuthorized,
  onSetupAppWallet,
  onTopUp,
}: AccountModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [customAmount, setCustomAmount] = useState('');

  // Update form when profile changes
  useEffect(() => {
    if (profile?.exists) {
      setDisplayName(profile.displayName);
      setBio(profile.bio);
    } else {
      setDisplayName('');
      setBio('');
    }
  }, [profile]);

  if (!isOpen) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(profile?.exists ? 'Updating profile...' : 'Creating profile...');

    try {
      if (profile?.exists) {
        await onUpdateProfile(displayName.trim(), bio.trim());
      } else {
        await onCreateProfile(displayName.trim(), bio.trim());
      }
      toast.success(profile?.exists ? 'Profile updated!' : 'Profile created!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupAppWallet = async () => {
    setIsSettingUp(true);
    const toastId = toast.loading('Setting up in-app wallet...');

    try {
      await onSetupAppWallet();
      toast.success('In-app wallet set up successfully!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed', { id: toastId });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleTopUp = async (amount: bigint) => {
    setIsFunding(true);
    const toastId = toast.loading('Topping up in-app wallet...');

    try {
      await onTopUp(amount);
      toast.success('In-app wallet funded!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Funding failed', { id: toastId });
    } finally {
      setIsFunding(false);
    }
  };

  const handleCustomTopUp = async () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    await handleTopUp(ethers.parseEther(customAmount));
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
      <div className="relative z-10 w-full max-w-2xl mx-4 border-2 border-orange-500 bg-black max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-black border-b-2 border-orange-500 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-orange-500 text-shadow-neon font-mono">
            ▄▄▄ ACCOUNT ▄▄▄
          </h2>
          <button
            onClick={onClose}
            className="text-orange-500 hover:text-orange-400 text-2xl font-mono"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* BROWSER WALLET SECTION */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 font-mono mb-3">BROWSER WALLET</h3>
            <div className="border border-orange-700 p-4">
              {walletAddress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="text-orange-400">● Connected:</span>
                    <span className="text-cyan-400">{truncateAddress(walletAddress)}</span>
                  </div>
                  <button
                    onClick={onDisconnect}
                    className="w-full py-2 border border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500"
                  >
                    DISCONNECT
                  </button>
                </div>
              ) : (
                <button
                  onClick={onConnect}
                  disabled={isConnecting}
                  className="w-full py-2 bg-orange-900 hover:bg-orange-800 text-orange-400 border-2 border-orange-500 font-mono text-sm disabled:opacity-50"
                >
                  {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
                </button>
              )}
            </div>
          </div>

          {/* PROFILE SECTION */}
          {walletAddress && (
            <div>
              <h3 className="text-sm font-bold text-cyan-400 font-mono mb-3">PROFILE</h3>
              <form onSubmit={handleProfileSubmit} className="border border-orange-700 p-4 space-y-4">
                <div>
                  <label className="block text-orange-400 font-mono text-sm mb-1">
                    DISPLAY NAME *
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-black border-2 border-orange-500 text-orange-400 font-mono text-sm focus:outline-none focus:border-orange-400 disabled:border-gray-700"
                    placeholder="Enter your display name"
                  />
                  <span className="text-xs text-orange-600 font-mono">
                    {displayName.length}/50 chars
                  </span>
                </div>

                <div>
                  <label className="block text-orange-400 font-mono text-sm mb-1">
                    BIO
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 bg-black border-2 border-orange-500 text-orange-400 font-mono text-sm focus:outline-none focus:border-orange-400 disabled:border-gray-700 resize-none"
                    placeholder="Tell us about yourself (optional)"
                  />
                  <span className="text-xs text-orange-600 font-mono">
                    {bio.length}/500 chars
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !displayName.trim()}
                  className="w-full py-2 bg-orange-900 hover:bg-orange-800 text-orange-400 border-2 border-orange-500 font-mono text-sm disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
                >
                  {isSubmitting ? 'SAVING...' : profile?.exists ? 'UPDATE PROFILE' : 'CREATE PROFILE'}
                </button>
              </form>
            </div>
          )}

          {/* IN-APP WALLET SECTION */}
          {walletAddress && profile?.exists && (
            <div>
              <h3 className="text-sm font-bold text-cyan-400 font-mono mb-3">
                IN-APP WALLET <span className="text-orange-600 text-xs">(gasless messaging)</span>
              </h3>

              {!isAuthorized ? (
                <div className="border border-orange-700 p-4 space-y-3">
                  <div className="font-mono text-sm text-orange-400">
                    Status: <span className="text-yellow-500">Not Set Up</span>
                  </div>
                  <p className="text-xs text-orange-600 font-mono">
                    Set up an in-app wallet to post messages without MetaMask popups. This creates a session wallet that can post on your behalf.
                  </p>
                  <button
                    onClick={handleSetupAppWallet}
                    disabled={isSettingUp}
                    className="w-full py-2 bg-cyan-900 hover:bg-cyan-800 text-cyan-400 border-2 border-cyan-500 font-mono text-sm disabled:opacity-50"
                  >
                    {isSettingUp ? 'SETTING UP...' : 'SETUP IN-APP WALLET'}
                  </button>
                </div>
              ) : (
                <div className="border border-orange-700 p-4 space-y-4">
                  <div className="font-mono text-sm space-y-2">
                    <div className="flex justify-between text-orange-400">
                      <span>Address:</span>
                      <span className="text-cyan-400">{truncateAddress(appWalletAddress!)}</span>
                    </div>
                    <div className="flex justify-between text-orange-400">
                      <span>Balance:</span>
                      <span className="text-cyan-400">
                        {formatBalance(appWalletBalance)} PAS {getFuelEmoji(appWalletBalance)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-orange-600 font-mono mb-2">Top up balance:</p>
                    <div className="flex gap-2 mb-3">
                      {SUGGESTED_AMOUNTS.map((amt) => (
                        <button
                          key={amt.label}
                          onClick={() => handleTopUp(amt.value)}
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
                        onClick={handleCustomTopUp}
                        disabled={isFunding || !customAmount}
                        className="px-4 py-2 bg-orange-900 hover:bg-orange-800 text-orange-400 border border-orange-500 font-mono text-sm disabled:opacity-50"
                      >
                        SEND
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
