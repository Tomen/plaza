import { useState, useEffect } from 'react';
import { truncateAddress } from '../utils/formatters';
import type { Profile } from '../types/contracts';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string | null;
  getProfile: (address: string) => Promise<Profile>;
  onStartDM?: (address: string) => void;
  dmRegistryAvailable?: boolean;
}

export function UserProfileModal({
  isOpen,
  onClose,
  userAddress,
  getProfile,
  onStartDM,
  dmRegistryAvailable = false,
}: UserProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!userAddress) return;
    await navigator.clipboard.writeText(userAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (isOpen && userAddress) {
      setIsLoading(true);
      setError(null);
      setProfile(null);

      getProfile(userAddress)
        .then((p) => {
          setProfile(p);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load profile');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, userAddress, getProfile]);

  if (!isOpen || !userAddress) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 border-2 border-primary-500 bg-black">
        {/* Header */}
        <div className="border-b-2 border-primary-500 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary-500 text-shadow-neon font-mono">
            ▄▄▄ USER PROFILE ▄▄▄
          </h2>
          <button
            onClick={onClose}
            className="text-primary-500 hover:text-primary-400 text-2xl font-mono"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-primary-500 font-mono text-sm animate-pulse">
                Loading profile...
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 font-mono text-sm">{error}</div>
            </div>
          ) : profile && !profile.exists ? (
            <div className="text-center py-8">
              <div className="text-primary-600 font-mono text-sm">
                This user hasn't created a profile yet.
              </div>
              <div className="mt-4">
                <span className="text-primary-400 font-mono text-xs">
                  {truncateAddress(userAddress)}
                </span>
              </div>
            </div>
          ) : profile ? (
            <>
              {/* Display Name */}
              <div>
                <label className="block text-primary-600 font-mono text-xs mb-1">
                  DISPLAY NAME
                </label>
                <div className="border-2 border-primary-700 p-3 bg-primary-950">
                  <span className="text-primary-300 font-mono text-sm">
                    {profile.displayName || '(unnamed)'}
                  </span>
                </div>
              </div>

              {/* Bio */}
              {profile.bio && (
                <div>
                  <label className="block text-primary-600 font-mono text-xs mb-1">
                    BIO
                  </label>
                  <div className="border-2 border-primary-700 p-3 bg-primary-950">
                    <span className="text-primary-300 font-mono text-sm whitespace-pre-wrap">
                      {profile.bio}
                    </span>
                  </div>
                </div>
              )}

              {/* Wallet Address */}
              <div>
                <label className="block text-primary-600 font-mono text-xs mb-1">
                  WALLET ADDRESS
                </label>
                <div className="border-2 border-primary-700 p-3 bg-primary-950 flex items-center justify-between">
                  <span className="text-accent-400 font-mono text-sm">
                    {truncateAddress(userAddress)}
                  </span>
                  <button
                    onClick={handleCopyAddress}
                    className="text-primary-500 hover:text-primary-400 font-mono text-xs ml-2"
                  >
                    {copied ? '✓ COPIED' : 'COPY'}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {/* Action buttons */}
          <div className="space-y-2 mt-4">
            {dmRegistryAvailable && onStartDM && userAddress && (
              <button
                onClick={() => {
                  onStartDM(userAddress);
                  onClose();
                }}
                className="w-full py-2 bg-accent-950 hover:bg-accent-900 border-2 border-accent-500 text-accent-400 font-mono text-sm hover:border-accent-400 transition-all"
              >
                SEND DM
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-900 hover:bg-gray-800 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
