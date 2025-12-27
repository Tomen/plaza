import { useState, useEffect } from 'react';
import { truncateAddress, formatBalance } from '../utils/formatters';
import { AddressDisplay } from './UserAddress';
import type { Profile, Link } from '../types/contracts';
import { UserPostsFeed } from './UserPostsFeed';
import { TipModal } from './TipModal';
import type { Provider, Signer } from '../utils/contracts';
import toast from 'react-hot-toast';

interface ProfileViewProps {
  userAddress: string | null;
  currentUserAddress?: string | null;
  getProfile: (address: string) => Promise<Profile>;
  onStartDM?: (address: string) => void;
  dmRegistryAvailable?: boolean;
  canSendDM?: boolean;
  hasSessionPublicKey?: (address: string) => Promise<boolean>;
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
  // Links
  links?: Link[];
  getLinks?: (address: string) => Promise<Link[]>;
  // Profile editing (for own profile)
  onUpdateDisplayName?: (name: string) => Promise<void>;
  onUpdateBio?: (bio: string) => Promise<void>;
  onAddLink?: (name: string, url: string) => Promise<void>;
  onRemoveLink?: (index: number) => Promise<void>;
  // Tipping
  sessionWallet?: Signer | null;
  sessionWalletAddress?: string | null;
  sessionWalletBalance?: bigint;
  browserProvider?: Provider | null;
  browserWalletAddress?: string | null;
  // Tooltip props for nested UserLinks
  isFollowingUser?: (address: string) => boolean;
  onTip?: (address: string) => void;
  canTip?: boolean;
  // Post selection
  selectedPostFromUrl?: number | null;
  onPostChange?: (postIndex: number | null) => void;
}

export function ProfileView({
  userAddress,
  currentUserAddress,
  getProfile,
  onStartDM,
  dmRegistryAvailable = false,
  canSendDM = false,
  hasSessionPublicKey,
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
  links: propLinks = [],
  getLinks,
  onUpdateDisplayName,
  onUpdateBio,
  onAddLink,
  onRemoveLink,
  sessionWallet,
  sessionWalletAddress,
  sessionWalletBalance,
  browserProvider,
  browserWalletAddress,
  // Tooltip props for nested UserLinks
  isFollowingUser,
  onTip,
  canTip = false,
  // Post selection
  selectedPostFromUrl,
  onPostChange,
}: ProfileViewProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [links, setLinks] = useState<Link[]>(propLinks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followActionLoading, setFollowActionLoading] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Tip modal state
  const [showTipModal, setShowTipModal] = useState(false);

  // Profile balance
  const [profileBalance, setProfileBalance] = useState<bigint>(0n);

  // Target user session key state
  const [targetHasSessionKey, setTargetHasSessionKey] = useState<boolean | null>(null);

  const isOwnProfile = userAddress?.toLowerCase() === currentUserAddress?.toLowerCase();
  const canEdit = isOwnProfile && onUpdateDisplayName && onUpdateBio;

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

  // Load links
  useEffect(() => {
    if (userAddress && getLinks) {
      getLinks(userAddress)
        .then(setLinks)
        .catch(() => setLinks([]));
    } else {
      setLinks(propLinks);
    }
  }, [userAddress, getLinks, propLinks]);

  // Reset edit mode when switching profiles
  useEffect(() => {
    setIsEditing(false);
  }, [userAddress]);

  // Fetch profile balance
  useEffect(() => {
    if (userAddress && provider) {
      provider.getBalance(userAddress)
        .then(setProfileBalance)
        .catch(() => setProfileBalance(0n));
    } else {
      setProfileBalance(0n);
    }
  }, [userAddress, provider]);

  // Check if target user has session key for encrypted DMs
  useEffect(() => {
    if (userAddress && hasSessionPublicKey) {
      hasSessionPublicKey(userAddress)
        .then(setTargetHasSessionKey)
        .catch(() => setTargetHasSessionKey(false));
    } else {
      setTargetHasSessionKey(null);
    }
  }, [userAddress, hasSessionPublicKey]);

  // Compute DM disabled state and reason
  const dmDisabled = !canSendDM || !profile?.exists || targetHasSessionKey === false;
  const dmDisabledReason = dmDisabled ? "Both users need a profile to send DMs" : undefined;

  // Start editing
  const handleStartEdit = () => {
    setEditName(profile?.displayName || '');
    setEditBio(profile?.bio || '');
    setIsEditing(true);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditName('');
    setEditBio('');
    setNewLinkName('');
    setNewLinkUrl('');
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!onUpdateDisplayName || !onUpdateBio || !profile) return;

    setIsSaving(true);
    try {
      // Update display name if changed
      if (editName !== profile.displayName && editName.trim()) {
        await onUpdateDisplayName(editName.trim());
        toast.success('Display name updated!');
      }

      // Update bio if changed
      if (editBio !== profile.bio) {
        await onUpdateBio(editBio);
        toast.success('Bio updated!');
      }

      // Refresh profile
      if (userAddress) {
        const updatedProfile = await getProfile(userAddress);
        setProfile(updatedProfile);
      }

      setIsEditing(false);
    } catch (err) {
      toast.error('Failed to update profile');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Add new link
  const handleAddLink = async () => {
    if (!onAddLink || !newLinkName.trim() || !newLinkUrl.trim()) return;

    setIsSaving(true);
    try {
      await onAddLink(newLinkName.trim(), newLinkUrl.trim());
      setNewLinkName('');
      setNewLinkUrl('');
      // Refresh links
      if (userAddress && getLinks) {
        const updatedLinks = await getLinks(userAddress);
        setLinks(updatedLinks);
      }
      toast.success('Link added!');
    } catch (err) {
      toast.error('Failed to add link');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Remove link
  const handleRemoveLink = async (index: number) => {
    if (!onRemoveLink) return;

    setIsSaving(true);
    try {
      await onRemoveLink(index);
      // Refresh links
      if (userAddress && getLinks) {
        const updatedLinks = await getLinks(userAddress);
        setLinks(updatedLinks);
      }
      toast.success('Link removed!');
    } catch (err) {
      toast.error('Failed to remove link');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

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
            {(isEditing ? editName : profile?.displayName)?.charAt(0).toUpperCase() || '?'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Display Name - inline editable */}
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={32}
                className="text-xl font-bold text-primary-500 font-mono bg-transparent border-b-2 border-primary-500 focus:border-accent-400 focus:outline-none w-full"
                placeholder="Display name..."
              />
            ) : (
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold text-primary-500 text-shadow-neon font-mono truncate">
                  {profile?.displayName || truncateAddress(userAddress)}
                </h1>
                <span className="text-sm text-primary-400 font-mono whitespace-nowrap">
                  {formatBalance(profileBalance)} PAS
                </span>
              </div>
            )}
            <div className="mt-1">
              <AddressDisplay address={userAddress} size="sm" />
            </div>

            {/* Bio - inline editable, elegant styling */}
            {isEditing ? (
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={256}
                rows={2}
                className="mt-3 w-full text-sm text-primary-400 font-mono bg-transparent border-b border-primary-700 focus:border-accent-400 focus:outline-none resize-none"
                placeholder="Tell us about yourself..."
              />
            ) : (profile?.bio || isOwnProfile) && (
              <p className="mt-3 text-sm text-primary-400 font-mono whitespace-pre-wrap">
                {profile?.bio || (isOwnProfile ? 'No bio yet' : '')}
              </p>
            )}

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
            <div className="mt-4 flex gap-2">
              {isOwnProfile && canEdit && !isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="px-4 py-1.5 bg-primary-900 border-2 border-primary-500 text-primary-400 text-sm font-mono hover:bg-primary-800 transition-colors"
                >
                  EDIT PROFILE
                </button>
              )}
              {isOwnProfile && isEditing && (
                <>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-accent-900 border-2 border-accent-500 text-accent-400 text-sm font-mono hover:bg-accent-800 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'SAVING...' : 'SAVE'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-gray-900 border-2 border-gray-600 text-gray-400 text-sm font-mono hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    CANCEL
                  </button>
                </>
              )}
              {!isOwnProfile && dmRegistryAvailable && onStartDM && (
                <div className="relative group">
                  <button
                    onClick={() => onStartDM(userAddress)}
                    disabled={dmDisabled}
                    className={`px-4 py-1.5 border-2 text-sm font-mono transition-colors ${
                      !dmDisabled
                        ? 'bg-accent-900 border-accent-500 text-accent-400 hover:bg-accent-800'
                        : 'bg-gray-900 border-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    SEND DM
                  </button>
                  {dmDisabled && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black border border-primary-700 text-primary-500 font-mono text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {dmDisabledReason}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary-700" />
                    </div>
                  )}
                </div>
              )}
              {!isOwnProfile && (sessionWallet || browserProvider) && (
                <button
                  onClick={() => setShowTipModal(true)}
                  className="px-4 py-1.5 bg-yellow-900 border-2 border-yellow-500 text-yellow-400 text-sm font-mono hover:bg-yellow-800 transition-colors"
                >
                  SEND TIP
                </button>
              )}
              {!isOwnProfile && onFollow && onUnfollow && (
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
              {/* Edit Mode - Links Section */}
              {isEditing && (
                <div>
                  <h3 className="text-sm font-bold text-accent-400 mb-3 font-mono">
                    LINKS
                  </h3>

                  {/* Existing Links */}
                  {links.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {links.map((link, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-primary-950 border border-primary-800"
                        >
                          <span className="text-primary-400 font-mono text-sm flex-shrink-0">
                            {link.name}
                          </span>
                          <span className="text-primary-600 font-mono text-xs truncate flex-1">
                            {link.url}
                          </span>
                          {onRemoveLink && (
                            <button
                              onClick={() => handleRemoveLink(idx)}
                              disabled={isSaving}
                              className="text-red-500 hover:text-red-400 text-sm font-mono disabled:opacity-50"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Link */}
                  {onAddLink && links.length < 10 && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLinkName}
                        onChange={(e) => setNewLinkName(e.target.value)}
                        maxLength={50}
                        className="flex-1 px-2 py-1.5 bg-primary-950 border border-primary-700 text-primary-300 font-mono text-sm focus:border-primary-500 focus:outline-none"
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        maxLength={200}
                        className="flex-[2] px-2 py-1.5 bg-primary-950 border border-primary-700 text-primary-300 font-mono text-sm focus:border-primary-500 focus:outline-none"
                        placeholder="https://..."
                      />
                      <button
                        onClick={handleAddLink}
                        disabled={isSaving || !newLinkName.trim() || !newLinkUrl.trim()}
                        className="px-3 py-1.5 bg-accent-900 border border-accent-600 text-accent-400 text-sm font-mono hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  )}
                  {links.length >= 10 && (
                    <p className="text-primary-600 font-mono text-xs mt-1">
                      Maximum 10 links reached
                    </p>
                  )}
                </div>
              )}

              {/* Links Display (View Mode) */}
              {!isEditing && links.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-accent-400 mb-2 font-mono">
                    LINKS
                  </h3>
                  <div className="border border-primary-700 p-3 bg-primary-950 space-y-1">
                    {links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm font-mono hover:bg-primary-900 p-1 -mx-1 transition-colors"
                      >
                        <span className="text-primary-500">→</span>
                        <span className="text-accent-400 hover:text-accent-300">
                          {link.name}
                        </span>
                        <span className="text-primary-700 text-xs truncate">
                          {link.url}
                        </span>
                      </a>
                    ))}
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
                    selectedPostIndex={selectedPostFromUrl}
                    onPostChange={onPostChange}
                    getProfile={getProfile}
                    onStartDM={onStartDM}
                    canSendDM={canSendDM}
                    onFollow={onFollow}
                    onUnfollow={onUnfollow}
                    isFollowing={isFollowingUser}
                    onTip={onTip}
                    canTip={canTip}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Tip Modal */}
      {userAddress && (
        <TipModal
          isOpen={showTipModal}
          onClose={() => setShowTipModal(false)}
          recipientAddress={userAddress}
          recipientName={profile?.displayName}
          sessionWallet={sessionWallet}
          sessionWalletAddress={sessionWalletAddress}
          sessionWalletBalance={sessionWalletBalance}
          browserProvider={browserProvider}
          browserWalletAddress={browserWalletAddress}
        />
      )}
    </div>
  );
}
