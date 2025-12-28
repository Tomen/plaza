import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { formatBalance, getFuelEmoji } from '../utils/formatters';
import { AddressDisplay } from './UserAddress';
import type { Profile } from '../types/contracts';
import type { WalletMode } from '../hooks/useAppWallet';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsViewProps {
  // Wallet
  walletAddress: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;

  // Profile
  profile: Profile | null;
  onCreateProfile: (displayName: string, bio: string) => Promise<void>;

  // Session account (formerly in-app wallet)
  appWalletAddress: string | null;
  appWalletBalance: bigint;
  isAuthorized: boolean;
  onSetupAppWallet: () => Promise<void>;
  onTopUp: (amount: bigint) => Promise<void>;

  // Wallet mode
  walletMode?: WalletMode;
  onExportPrivateKey?: () => void;
  onConnectBrowserWallet?: () => void;

  // Profile editing (for standalone mode)
  onUpdateDisplayName?: (displayName: string) => Promise<void>;
  onUpdateBio?: (bio: string) => Promise<void>;
}

export function SettingsView({
  walletAddress,
  isConnecting,
  onConnect,
  onDisconnect,
  profile,
  onCreateProfile,
  appWalletAddress,
  appWalletBalance,
  isAuthorized,
  onSetupAppWallet,
  onTopUp,
  walletMode = 'none',
  onExportPrivateKey,
  onConnectBrowserWallet,
  onUpdateDisplayName,
  onUpdateBio,
}: SettingsViewProps) {
  const isStandaloneMode = walletMode === 'standalone';
  const { theme, setTheme } = useTheme();
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [customAmount, setCustomAmount] = useState('10');

  // Profile editing state (for standalone mode)
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Initialize edit fields from profile when it loads
  useEffect(() => {
    if (profile?.exists) {
      setEditDisplayName(profile.displayName);
      setEditBio(profile.bio);
    }
  }, [profile]);

  const handleCreateProfile = async () => {
    if (!newDisplayName.trim()) {
      toast.error('Please enter a display name');
      return;
    }

    setIsCreatingProfile(true);
    const toastId = toast.loading('Creating profile...');

    try {
      await onCreateProfile(newDisplayName.trim(), newBio.trim());
      toast.success('Profile created!', { id: toastId });
      setNewDisplayName('');
      setNewBio('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create profile', { id: toastId });
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleSetupAppWallet = async () => {
    setIsSettingUp(true);
    const toastId = toast.loading('Setting up session account...');

    try {
      await onSetupAppWallet();
      toast.success('Session account set up successfully!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed', { id: toastId });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleTopUp = async (amount: bigint) => {
    setIsFunding(true);
    const toastId = toast.loading('Topping up session account...');

    try {
      await onTopUp(amount);
      toast.success('Session account funded!', { id: toastId });
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

  const handleSaveProfile = async () => {
    if (!onUpdateDisplayName || !onUpdateBio) return;
    if (!editDisplayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }

    setIsSavingProfile(true);
    const toastId = toast.loading('Saving profile...');

    try {
      // Only update if values changed
      if (editDisplayName.trim() !== profile?.displayName) {
        await onUpdateDisplayName(editDisplayName.trim());
      }
      if (editBio.trim() !== profile?.bio) {
        await onUpdateBio(editBio.trim());
      }
      toast.success('Profile saved!', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile', { id: toastId });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black overflow-y-auto">
      {/* Header */}
      <div className="border-b-2 border-primary-500 bg-primary-950 bg-opacity-30 px-6 py-4">
        <h2 className="text-xl font-bold text-primary-500 text-shadow-neon font-mono">
          SETTINGS
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* WALLET SECTION */}
          <div>
            <h3 className="text-sm font-bold text-accent-400 font-mono mb-3">
              {isStandaloneMode ? 'IN-APP WALLET' : 'BROWSER WALLET'}
            </h3>
            <div className="border border-primary-700 p-4">
              {walletAddress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-sm">
                    <span className="text-primary-400">
                      {isStandaloneMode ? 'In-App:' : 'Connected:'}
                    </span>
                    <AddressDisplay address={walletAddress} size="sm" />
                  </div>
                  {isStandaloneMode && (
                    <div className="flex items-center justify-between font-mono text-sm">
                      <span className="text-primary-400">Balance:</span>
                      <span className="text-accent-400">
                        {formatBalance(appWalletBalance)} PAS {getFuelEmoji(appWalletBalance)}
                      </span>
                    </div>
                  )}
                  {isStandaloneMode && onExportPrivateKey && (
                    <button
                      onClick={onExportPrivateKey}
                      className="w-full py-2 bg-yellow-900 hover:bg-yellow-800 border-2 border-yellow-600 text-yellow-400 font-mono text-sm hover:border-yellow-500 transition-all"
                    >
                      EXPORT PRIVATE KEY
                    </button>
                  )}
                  {isStandaloneMode && onConnectBrowserWallet && (
                    <button
                      onClick={onConnectBrowserWallet}
                      className="w-full py-2 bg-accent-900 hover:bg-accent-800 border-2 border-accent-600 text-accent-400 font-mono text-sm hover:border-accent-500 transition-all"
                    >
                      CONNECT BROWSER WALLET
                    </button>
                  )}
                  <button
                    onClick={onDisconnect}
                    className="w-full py-2 bg-gray-900 hover:bg-gray-800 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 transition-all"
                  >
                    DISCONNECT
                  </button>
                </div>
              ) : (
                <button
                  onClick={onConnect}
                  disabled={isConnecting}
                  className="w-full py-2 bg-primary-900 hover:bg-primary-800 text-primary-400 border-2 border-primary-500 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                  {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
                </button>
              )}
            </div>
          </div>

          {/* PROFILE SECTION - For standalone users to customize profile */}
          {isStandaloneMode && walletAddress && profile?.exists && onUpdateDisplayName && (
            <div>
              <h3 className="text-sm font-bold text-accent-400 font-mono mb-3">
                PROFILE
              </h3>
              <div className="border border-accent-500 p-4 space-y-4">
                <div>
                  <label className="block text-xs text-primary-600 font-mono mb-1">
                    DISPLAY NAME
                  </label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    disabled={isSavingProfile}
                    maxLength={32}
                    className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-accent-400 disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-xs text-primary-600 font-mono mb-1">
                    BIO
                  </label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    disabled={isSavingProfile}
                    maxLength={256}
                    rows={3}
                    className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-accent-400 disabled:opacity-70 resize-none"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || (editDisplayName === profile?.displayName && editBio === profile?.bio)}
                  className="w-full py-2 bg-accent-900 hover:bg-accent-800 text-accent-400 border-2 border-accent-500 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                  {isSavingProfile ? 'SAVING...' : 'SAVE PROFILE'}
                </button>
              </div>
            </div>
          )}

          {/* PROFILE SECTION - Show create form if no profile (browser mode only) */}
          {!isStandaloneMode && walletAddress && !profile?.exists && (
            <div>
              <h3 className="text-sm font-bold text-accent-400 font-mono mb-3">
                CREATE PROFILE
              </h3>
              <div className="border border-accent-500 p-4 space-y-4">
                <p className="text-sm text-primary-400 font-mono">
                  Create a profile to start posting and using Plaza.
                </p>

                <div>
                  <label className="block text-xs text-primary-600 font-mono mb-1">
                    DISPLAY NAME *
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    disabled={isCreatingProfile}
                    maxLength={32}
                    className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-accent-400 disabled:opacity-70 placeholder:text-primary-700"
                  />
                </div>

                <div>
                  <label className="block text-xs text-primary-600 font-mono mb-1">
                    BIO <span className="text-primary-700">(optional)</span>
                  </label>
                  <textarea
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    disabled={isCreatingProfile}
                    maxLength={256}
                    rows={3}
                    className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-accent-400 disabled:opacity-70 placeholder:text-primary-700 resize-none"
                  />
                </div>

                <button
                  onClick={handleCreateProfile}
                  disabled={isCreatingProfile || !newDisplayName.trim()}
                  className="w-full py-2 bg-accent-900 hover:bg-accent-800 text-accent-400 border-2 border-accent-500 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                >
                  {isCreatingProfile ? 'CREATING...' : 'CREATE PROFILE'}
                </button>
              </div>
            </div>
          )}

          {/* SESSION ACCOUNT SECTION (browser wallet mode only, after profile exists) */}
          {!isStandaloneMode && walletAddress && profile?.exists && (
            <div>
              <h3 className="text-sm font-bold text-accent-400 font-mono mb-3">
                SESSION ACCOUNT <span className="text-primary-600 text-xs">(gasless messaging)</span>
              </h3>

              {!isAuthorized ? (
                <div className="border border-primary-700 p-4 space-y-3">
                  <div className="font-mono text-sm text-primary-400">
                    Status: <span className="text-yellow-500">Not Set Up</span>
                  </div>
                  <p className="text-xs text-primary-600 font-mono">
                    Set up a session account to post messages without MetaMask popups. This creates a delegate wallet that can post on your behalf.
                  </p>
                  <button
                    onClick={handleSetupAppWallet}
                    disabled={isSettingUp}
                    className="w-full py-2 bg-accent-900 hover:bg-accent-800 text-accent-400 border-2 border-accent-500 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                  >
                    {isSettingUp ? 'SETTING UP...' : 'SETUP SESSION ACCOUNT'}
                  </button>
                </div>
              ) : (
                <div className="border border-primary-700 p-4 space-y-4">
                  <div className="font-mono text-sm space-y-2">
                    <div className="flex justify-between text-primary-400">
                      <span>Address:</span>
                      <AddressDisplay address={appWalletAddress!} size="sm" />
                    </div>
                    <div className="flex justify-between text-primary-400">
                      <span>Balance:</span>
                      <span className="text-accent-400">
                        {formatBalance(appWalletBalance)} PAS {getFuelEmoji(appWalletBalance)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-primary-600 font-mono mb-2">Top up balance:</p>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="10"
                          disabled={isFunding}
                          className="w-full px-3 py-2 pr-12 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 text-right disabled:opacity-70"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-600 font-mono text-sm pointer-events-none">
                          PAS
                        </span>
                      </div>
                      <button
                        onClick={handleCustomTopUp}
                        disabled={isFunding || !customAmount}
                        className="px-4 py-2 bg-primary-900 hover:bg-primary-800 text-primary-400 border-2 border-primary-500 font-mono text-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all"
                      >
                        SEND
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* THEME SECTION */}
          {walletAddress && (
            <div>
              <h3 className="text-sm font-bold text-accent-400 font-mono mb-3">THEME</h3>
              <div className="border border-primary-700 p-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setTheme('neon')}
                    className={`flex-1 py-3 px-4 border-2 font-mono text-sm transition-all ${
                      theme === 'neon'
                        ? 'bg-primary-900 hover:bg-primary-800 border-primary-500 hover:border-primary-400 text-primary-400'
                        : 'bg-black border-primary-700 text-primary-600 hover:border-primary-500 hover:bg-primary-900 hover:text-primary-400'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold">NEON</div>
                      <div className="text-xs opacity-75">Orange glow effects</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setTheme('grayscale')}
                    className={`flex-1 py-3 px-4 border-2 font-mono text-sm transition-all ${
                      theme === 'grayscale'
                        ? 'bg-primary-900 hover:bg-primary-800 border-primary-500 hover:border-primary-400 text-primary-400'
                        : 'bg-black border-primary-700 text-primary-600 hover:border-primary-500 hover:bg-primary-900 hover:text-primary-400'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold">GRAYSCALE</div>
                      <div className="text-xs opacity-75">Clean minimal look</div>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-primary-600 font-mono mt-3">
                  {theme === 'neon'
                    ? 'Vibrant orange/cyan with neon glow effects'
                    : 'Grayscale with subtle blue accents, no glows'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
