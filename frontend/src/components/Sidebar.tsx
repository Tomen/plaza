import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import type { RegisteredChannel } from '../types/contracts';
import { PostingMode } from '../types/contracts';
import type { ConversationInfo } from '../hooks/useDMRegistry';
import ChatChannelABI from '../contracts/ChatChannel.json';
import { truncateAddress } from '../utils/formatters';

interface ChannelListItem {
  address: string;
  name: string;
  postingMode: number;
}

interface ConversationWithName extends ConversationInfo {
  displayName: string;
}

interface FollowingUser {
  address: string;
  displayName: string;
}

export type ViewMode = 'channels' | 'dms' | 'profile' | 'settings' | 'forum';

export type SidebarSection = 'channels' | 'dms' | 'following';

interface SidebarExpanded {
  channels: boolean;
  dms: boolean;
  following: boolean;
}

interface SidebarProps {
  channels: RegisteredChannel[];
  selectedChannel: string | null;
  onSelectChannel: (address: string) => void;
  onCreateChannel: () => void;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  isConnected: boolean;
  // View mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  // DM-related props
  dmConversations?: ConversationInfo[];
  selectedConversation?: string | null;
  onSelectConversation?: (address: string) => void;
  onNewDM?: () => void;
  dmLoading?: boolean;
  dmRegistryAvailable?: boolean;
  getDisplayName?: (address: string) => Promise<string>;
  // Following props
  following?: string[];
  selectedProfile?: string | null;
  onSelectProfile?: (address: string) => void;
  followRegistryAvailable?: boolean;
  // Sidebar expansion state
  sidebarExpanded?: SidebarExpanded;
  onToggleSection?: (section: SidebarSection) => void;
  // Current user for My Profile
  currentUserAddress?: string | null;
  currentUserDisplayName?: string | null;
  // Callback to trigger wallet connection (for guest mode)
  onConnectWallet?: () => void;
  // Forum availability
  forumAvailable?: boolean;
}

export function Sidebar({
  channels,
  selectedChannel,
  onSelectChannel,
  onCreateChannel,
  provider,
  isConnected,
  viewMode,
  onViewModeChange,
  dmConversations = [],
  selectedConversation,
  onSelectConversation,
  onNewDM,
  dmLoading = false,
  dmRegistryAvailable = false,
  getDisplayName,
  following = [],
  selectedProfile,
  onSelectProfile,
  followRegistryAvailable = false,
  sidebarExpanded = { channels: true, dms: true, following: true },
  onToggleSection,
  currentUserAddress,
  currentUserDisplayName,
  onConnectWallet,
  forumAvailable = false,
}: SidebarProps) {
  const [channelNames, setChannelNames] = useState<ChannelListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationsWithNames, setConversationsWithNames] = useState<ConversationWithName[]>([]);
  const [loadingDMNames, setLoadingDMNames] = useState(false);
  const [followingWithNames, setFollowingWithNames] = useState<FollowingUser[]>([]);
  const [loadingFollowingNames, setLoadingFollowingNames] = useState(false);

  // Load channel names
  useEffect(() => {
    if (!provider || channels.length === 0) {
      setChannelNames([]);
      return;
    }

    const loadChannelNames = async () => {
      setIsLoading(true);
      try {
        const names = await Promise.all(
          channels.map(async (ch) => {
            try {
              const contract = new ethers.Contract(
                ch.channelAddress,
                ChatChannelABI.abi,
                provider
              );
              const [name, postingMode] = await Promise.all([
                contract.name(),
                contract.postingMode(),
              ]);
              return { address: ch.channelAddress, name, postingMode: Number(postingMode) };
            } catch {
              return { address: ch.channelAddress, name: 'Unknown', postingMode: 0 };
            }
          })
        );
        setChannelNames(names);
      } finally {
        setIsLoading(false);
      }
    };

    loadChannelNames();
  }, [channels, provider]);

  // Load DM conversation display names
  useEffect(() => {
    if (dmConversations.length === 0 || !getDisplayName) {
      setConversationsWithNames([]);
      return;
    }

    setLoadingDMNames(true);
    Promise.all(
      dmConversations.map(async (conv) => {
        const displayName = await getDisplayName(conv.otherParticipant);
        return { ...conv, displayName };
      })
    )
      .then(setConversationsWithNames)
      .finally(() => setLoadingDMNames(false));
  }, [dmConversations, getDisplayName]);

  // Load following display names
  useEffect(() => {
    if (following.length === 0 || !getDisplayName) {
      setFollowingWithNames([]);
      return;
    }

    setLoadingFollowingNames(true);
    Promise.all(
      following.map(async (address) => {
        const displayName = await getDisplayName(address);
        return { address, displayName };
      })
    )
      .then(setFollowingWithNames)
      .finally(() => setLoadingFollowingNames(false));
  }, [following, getDisplayName]);

  const handleToggle = (section: SidebarSection) => {
    onToggleSection?.(section);
  };

  const handleChannelClick = (address: string) => {
    onSelectChannel(address);
    onViewModeChange('channels');
  };

  const handleDMClick = (address: string) => {
    onSelectConversation?.(address);
    onViewModeChange('dms');
  };

  const handleProfileClick = (address: string) => {
    onSelectProfile?.(address);
    onViewModeChange('profile');
  };

  const handleMyProfileClick = () => {
    if (currentUserAddress) {
      onSelectProfile?.(currentUserAddress);
      onViewModeChange('profile');
    }
  };

  const handleSettingsClick = () => {
    onViewModeChange('settings');
  };

  const handleForumClick = () => {
    onViewModeChange('forum');
  };

  return (
    <div className="w-64 border-r-2 border-primary-500 bg-black flex flex-col">
      {/* My Profile Section */}
      {isConnected && currentUserAddress && (
        <div className="border-b-2 border-primary-500">
          <button
            onClick={handleMyProfileClick}
            className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm transition-all ${
              viewMode === 'profile' && selectedProfile === currentUserAddress
                ? 'bg-primary-900 text-primary-300'
                : 'text-primary-500 hover:bg-primary-950'
            }`}
          >
            <span className="text-accent-400">@</span>
            <span className="font-bold truncate">
              {currentUserDisplayName || truncateAddress(currentUserAddress)}
            </span>
          </button>
        </div>
      )}

      {/* Forum Navigation */}
      {forumAvailable && (
        <div className="border-b border-primary-800">
          <button
            onClick={handleForumClick}
            className={`w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-all ${
              viewMode === 'forum'
                ? 'bg-primary-900 text-primary-300 border-l-2 border-primary-400'
                : 'text-primary-500 hover:bg-primary-950'
            }`}
          >
            <span className="text-primary-500">&#9776;</span>
            <span className="font-semibold">Forum</span>
          </button>
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Channels Section */}
        <div className="border-b border-primary-800">
          <button
            onClick={() => handleToggle('channels')}
            className="w-full text-left px-4 py-2 flex items-center gap-2 text-sm text-primary-600 hover:bg-primary-950"
          >
            <span className={`text-xs transition-transform ${sidebarExpanded.channels ? 'rotate-90' : ''}`}>
              &#9654;
            </span>
            <span className="font-bold">Channels</span>
            <span className="text-primary-700 text-xs ml-auto">{channelNames.length}</span>
          </button>

          {sidebarExpanded.channels && (
            <div className="pl-4">
              {isLoading ? (
                <div className="px-4 py-2 text-primary-600 font-mono text-sm">
                  Loading...
                </div>
              ) : channelNames.length === 0 ? (
                <div className="px-4 py-2 text-primary-700 font-mono text-sm">
                  No channels
                </div>
              ) : (
                channelNames.map((ch) => (
                  <button
                    key={ch.address}
                    onClick={() => handleChannelClick(ch.address)}
                    className={`w-full text-left px-4 py-1.5 flex items-center gap-2 text-sm transition-all ${
                      viewMode === 'channels' && selectedChannel === ch.address
                        ? 'bg-primary-900 text-primary-300 border-l-2 border-primary-400'
                        : 'text-primary-500 hover:bg-primary-950'
                    }`}
                  >
                    <span className="text-center">
                      {ch.postingMode === PostingMode.Permissioned ? (
                        <span className="text-yellow-500 text-xs">&#x1F512;</span>
                      ) : (
                        <span className="text-accent-500">#</span>
                      )}
                    </span>
                    {ch.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* DMs Section */}
        {dmRegistryAvailable && (
          <div className="border-b border-primary-800">
            <button
              onClick={() => handleToggle('dms')}
              className="w-full text-left px-4 py-2 flex items-center gap-2 text-sm text-primary-600 hover:bg-primary-950"
            >
              <span className={`text-xs transition-transform ${sidebarExpanded.dms ? 'rotate-90' : ''}`}>
                &#9654;
              </span>
              <span className="font-bold">DMs</span>
              <span className="text-primary-700 text-xs ml-auto">{conversationsWithNames.length}</span>
            </button>

            {sidebarExpanded.dms && (
              <div className="pl-4">
                {dmLoading || loadingDMNames ? (
                  <div className="px-4 py-2 text-primary-600 font-mono text-sm">
                    Loading...
                  </div>
                ) : conversationsWithNames.length === 0 ? (
                  <div className="px-4 py-2 text-primary-700 font-mono text-sm">
                    No conversations
                  </div>
                ) : (
                  conversationsWithNames.map((conv) => (
                    <button
                      key={conv.address}
                      onClick={() => handleDMClick(conv.address)}
                      className={`w-full text-left px-4 py-1.5 flex items-center gap-2 text-sm transition-all ${
                        viewMode === 'dms' && selectedConversation === conv.address
                          ? 'bg-accent-900 text-accent-300 border-l-2 border-accent-400'
                          : 'text-primary-500 hover:bg-primary-950'
                      }`}
                    >
                      <span className="text-accent-400">@</span>
                      <span className="truncate">
                        {conv.displayName || truncateAddress(conv.otherParticipant)}
                      </span>
                      {conv.messageCount > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 bg-primary-900 text-primary-500 text-xs">
                          {conv.messageCount}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Following Section */}
        {followRegistryAvailable && (
          <div className="border-b border-primary-800">
            <button
              onClick={() => handleToggle('following')}
              className="w-full text-left px-4 py-2 flex items-center gap-2 text-sm text-primary-600 hover:bg-primary-950"
            >
              <span className={`text-xs transition-transform ${sidebarExpanded.following ? 'rotate-90' : ''}`}>
                &#9654;
              </span>
              <span className="font-bold">Following</span>
              <span className="text-primary-700 text-xs ml-auto">{followingWithNames.length}</span>
            </button>

            {sidebarExpanded.following && (
              <div className="pl-4">
                {loadingFollowingNames ? (
                  <div className="px-4 py-2 text-primary-600 font-mono text-sm">
                    Loading...
                  </div>
                ) : followingWithNames.length === 0 ? (
                  <div className="px-4 py-2 text-primary-700 font-mono text-sm">
                    Not following anyone
                  </div>
                ) : (
                  followingWithNames.map((user) => (
                    <button
                      key={user.address}
                      onClick={() => handleProfileClick(user.address)}
                      className={`w-full text-left px-4 py-1.5 flex items-center gap-2 text-sm transition-all ${
                        viewMode === 'profile' && selectedProfile === user.address
                          ? 'bg-accent-900 text-accent-300 border-l-2 border-accent-400'
                          : 'text-primary-500 hover:bg-primary-950'
                      }`}
                    >
                      <span className="text-primary-600">&#9679;</span>
                      <span className="truncate">
                        {user.displayName || truncateAddress(user.address)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons - shown for all users, triggers wallet connection if not connected */}
      <div className="p-3 border-t border-primary-800 space-y-2">
        <button
          onClick={isConnected ? onCreateChannel : onConnectWallet}
          className="w-full py-1.5 text-xs text-primary-600 hover:text-primary-400 hover:bg-primary-950 text-left px-2 transition-colors"
        >
          + New Channel
        </button>
        {dmRegistryAvailable && (
          <button
            onClick={isConnected ? onNewDM : onConnectWallet}
            className="w-full py-1.5 text-xs text-primary-600 hover:text-primary-400 hover:bg-primary-950 text-left px-2 transition-colors"
          >
            + New DM
          </button>
        )}
      </div>

      {/* Settings Button */}
      <div className="border-t-2 border-primary-500">
        <button
          onClick={handleSettingsClick}
          className={`w-full text-left px-4 py-3 flex items-center gap-2 text-sm transition-all ${
            viewMode === 'settings'
              ? 'bg-primary-900 text-primary-300'
              : 'text-primary-600 hover:bg-primary-950 hover:text-primary-400'
          }`}
        >
          <span>&#9881;</span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
