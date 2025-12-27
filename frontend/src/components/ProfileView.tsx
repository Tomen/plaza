import { useState, useEffect } from 'react';
import { truncateAddress } from '../utils/formatters';
import type { Profile } from '../types/contracts';
import { UserPostsFeed } from './UserPostsFeed';
import type { Provider, Signer } from '../utils/contracts';

interface ProfileViewProps {
  userAddress: string | null;
  currentUserAddress?: string | null;
  getProfile: (address: string) => Promise<Profile>;
  onStartDM?: (address: string) => void;
  dmRegistryAvailable?: boolean;
  // Follow functionality
  isFollowing?: boolean;
  onFollow?: (address: string) => Promise<void>;
  onUnfollow?: (address: string) => Promise<void>;
  followLoading?: boolean;
  // Stats
  followerCount?: number;
  followingCount?: number;
  // Posts functionality
  userPostsAddress?: string | null;
  repliesAddress?: string | null;
  votingAddress?: string | null;
  provider?: Provider | null;
  signer?: Signer | null;
  getDisplayName?: (address: string) => Promise<string>;
  onSelectUser?: (address: string) => void;
}

export function ProfileView({
  userAddress,
  currentUserAddress,
  getProfile,
  onStartDM,
  dmRegistryAvailable = false,
  isFollowing = false,
  onFollow,
  onUnfollow,
  followLoading = false,
  followerCount = 0,
  followingCount = 0,
  userPostsAddress,
  repliesAddress,
  votingAddress,
  provider,
  signer,
  getDisplayName,
  onSelectUser,
}: ProfileViewProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [followActionLoading, setFollowActionLoading] = useState(false);

  const isOwnProfile = userAddress?.toLowerCase() === currentUserAddress?.toLowerCase();

  const handleCopyAddress = async () => {
    if (!userAddress) return;
    await navigator.clipboard.writeText(userAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollow = async () => {
    if (!userAddress || !onFollow) return;
    setFollowActionLoading(true);
    try {
      await onFollow(userAddress);
    } finally {
      setFollowActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!userAddress || !onUnfollow) return;
    setFollowActionLoading(true);
    try {
      await onUnfollow(userAddress);
    } finally {
      setFollowActionLoading(false);
    }
  };

  useEffect(() => {
    if (userAddress) {
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
  }, [userAddress, getProfile]);

  if (!userAddress) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-primary-600 font-mono text-sm">
          SELECT A USER TO VIEW THEIR PROFILE
        </p>
      </div>
    );
  }

  if (isLoading || followLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-primary-500 font-mono text-sm animate-pulse">
          Loading profile...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-500 font-mono text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b-2 border-primary-500 p-6">
        <div className="max-w-2xl mx-auto flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 border-2 border-primary-500 bg-primary-950 flex items-center justify-center text-primary-500 text-2xl font-mono flex-shrink-0">
            {profile?.displayName?.charAt(0).toUpperCase() || '?'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-primary-500 text-shadow-neon font-mono truncate">
              {profile?.displayName || truncateAddress(userAddress)}
            </h1>
            <button
              onClick={handleCopyAddress}
              className="text-accent-400 text-sm font-mono hover:underline mt-1"
            >
              {copied ? '✓ Copied!' : truncateAddress(userAddress)}
            </button>

            {/* Stats */}
            <div className="mt-3 flex gap-4 text-xs font-mono">
              <span>
                <span className="text-primary-600">FOLLOWING:</span>{' '}
                <span className="text-primary-400">{followingCount}</span>
              </span>
              <span>
                <span className="text-primary-600">FOLLOWERS:</span>{' '}
                <span className="text-primary-400">{followerCount}</span>
              </span>
            </div>

            {/* Action buttons */}
            {!isOwnProfile && (
              <div className="mt-4 flex gap-2">
                {dmRegistryAvailable && onStartDM && (
                  <button
                    onClick={() => onStartDM(userAddress)}
                    className="px-4 py-1.5 bg-accent-900 border-2 border-accent-500 text-accent-400 text-sm font-mono hover:bg-accent-800 transition-colors"
                  >
                    SEND DM
                  </button>
                )}
                {onFollow && onUnfollow && (
                  <button
                    onClick={isFollowing ? handleUnfollow : handleFollow}
                    disabled={followActionLoading}
                    className={`px-4 py-1.5 border-2 text-sm font-mono transition-colors ${
                      followActionLoading
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    } ${
                      isFollowing
                        ? 'bg-gray-900 border-gray-600 text-gray-400 hover:bg-gray-800'
                        : 'bg-primary-900 border-primary-500 text-primary-400 hover:bg-primary-800'
                    }`}
                  >
                    {followActionLoading
                      ? '...'
                      : isFollowing
                      ? 'UNFOLLOW'
                      : 'FOLLOW'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {profile && !profile.exists ? (
            <div className="text-center py-8">
              <div className="text-primary-600 font-mono text-sm">
                This user hasn't created a profile yet.
              </div>
            </div>
          ) : profile ? (
            <>
              {/* Bio */}
              {profile.bio && (
                <div>
                  <h3 className="text-sm font-bold text-accent-400 mb-2 font-mono">
                    BIO
                  </h3>
                  <div className="border border-primary-700 p-4 bg-primary-950">
                    <p className="text-primary-300 text-sm font-mono whitespace-pre-wrap">
                      {profile.bio}
                    </p>
                  </div>
                </div>
              )}

              {/* Empty state for bio */}
              {!profile.bio && (
                <div className="text-center py-4">
                  <div className="text-primary-700 font-mono text-sm">
                    No bio added yet.
                  </div>
                </div>
              )}

              {/* Posts Feed */}
              {userPostsAddress && (
                <div className="mt-6 pt-6 border-t border-primary-800">
                  <UserPostsFeed
                    userPostsAddress={userPostsAddress}
                    repliesAddress={repliesAddress ?? null}
                    votingAddress={votingAddress ?? null}
                    profileOwner={userAddress}
                    provider={provider ?? null}
                    signer={signer}
                    currentAddress={currentUserAddress ?? null}
                    getDisplayName={getDisplayName}
                    onSelectUser={onSelectUser}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
