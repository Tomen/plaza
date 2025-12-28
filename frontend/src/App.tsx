import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { useWallet } from './hooks/useWallet';
import { useChannelRegistry } from './hooks/useChannelRegistry';
import { useChannel } from './hooks/useChannel';
import { useUserRegistry } from './hooks/useUserRegistry';
import { useAppWallet, type WalletMode } from './hooks/useAppWallet';
import { useDMRegistry } from './hooks/useDMRegistry';
import { useDMConversation } from './hooks/useDMConversation';
import { useSessionKeys } from './hooks/useSessionKeys';
import { useDeployments } from './hooks/useDeployments';
import { useFollowRegistry } from './hooks/useFollowRegistry';
import { hasStandaloneWallet } from './utils/appWallet';
import { truncateAddress } from './utils/formatters';
import { AccountButton } from './components/AccountButton';
import { ChatFeed } from './components/ChatFeed';
import { MessageInput } from './components/MessageInput';
import { Sidebar, type ViewMode, type SidebarSection } from './components/Sidebar';
import { ProfileView } from './components/ProfileView';
import { ChannelHeader } from './components/ChannelHeader';
import { ChannelModerationModal } from './components/ChannelModerationModal';
import { UserListPanel } from './components/UserListPanel';
import { CreateChannelModal } from './components/CreateChannelModal';
import { WalletChoiceModal } from './components/WalletChoiceModal';
import { SessionAccountSetup } from './components/SessionAccountSetup';
import { PrivateKeyExportModal } from './components/PrivateKeyExportModal';
import { LinkBrowserWalletModal } from './components/LinkBrowserWalletModal';
import { DMConversationView } from './components/DMConversationView';
import { NewDMModal } from './components/NewDMModal';
import { SettingsView } from './components/SettingsView';
import { ForumView } from './components/ForumView';
import { TipModal } from './components/TipModal';
import type { PostingMode } from './types/contracts';

// RPC URL for standalone wallet (Paseo Asset Hub testnet)
const RPC_URL = 'https://testnet-passet-hub-eth-rpc.polkadot.io';

function App() {
  // Load deployments from JSON file
  const { currentNetwork: deployments } = useDeployments();

  // Get registry address from URL parameter or deployments.json
  const urlParams = new URLSearchParams(window.location.search);
  const registryAddress = urlParams.get('registry') || deployments?.channelRegistry || null;
  const dmRegistryAddress = urlParams.get('dmRegistry') || deployments?.dmRegistry || null;
  const followRegistryAddress = urlParams.get('followRegistry') || deployments?.followRegistry || null;
  const userPostsAddress = deployments?.userPosts || null;
  const repliesAddress = deployments?.replies || null;
  const votingAddress = deployments?.voting || null;
  const forumThreadAddress = deployments?.forumThread || null;
  const directChannelAddress = urlParams.get('channel');
  const directDMAddress = urlParams.get('dm');
  const directProfileAddress = urlParams.get('profile');
  const directThreadIndex = urlParams.get('thread');
  const directPostIndex = urlParams.get('post');

  // Only show registry in URL if user provided non-default registry addresses
  const showRegistryInUrl = useMemo(() => {
    if (import.meta.env.VITE_SHOW_REGISTRY_IN_URL === 'true') return true;

    const params = new URLSearchParams(window.location.search);
    const urlRegistry = params.get('registry');
    const urlDmRegistry = params.get('dmRegistry');

    // Show in URL only if user provided addresses that differ from defaults
    const registryDiffers = urlRegistry && urlRegistry !== deployments?.channelRegistry;
    const dmRegistryDiffers = urlDmRegistry && urlDmRegistry !== deployments?.dmRegistry;

    return registryDiffers || dmRegistryDiffers;
  }, [deployments?.channelRegistry, deployments?.dmRegistry]);

  // Wallet mode: 'browser' | 'standalone' | 'none'
  // Persisted in localStorage so disconnect state survives page refresh
  const [walletMode, setWalletMode] = useState<WalletMode>(() => {
    const storedMode = localStorage.getItem('walletMode') as WalletMode | null;

    // If user explicitly disconnected (stored 'none'), respect that
    if (storedMode === 'none') {
      return 'none';
    }

    // If stored mode is browser, use it (MetaMask will auto-reconnect)
    if (storedMode === 'browser') {
      return 'browser';
    }

    // If stored mode is standalone and wallet exists, use it
    if (storedMode === 'standalone' && hasStandaloneWallet()) {
      return 'standalone';
    }

    // If no stored mode but wallet exists, auto-connect (first visit after creating wallet)
    if (!storedMode && hasStandaloneWallet()) {
      return 'standalone';
    }

    return 'none';
  });

  // Persist wallet mode changes to localStorage
  useEffect(() => {
    localStorage.setItem('walletMode', walletMode);
  }, [walletMode]);

  // Standalone provider (for in-app wallet mode)
  const [standaloneProvider] = useState(() => new ethers.JsonRpcProvider(RPC_URL));

  // Browser wallet state
  const browserWallet = useWallet();

  // On-chain delegate check callback - set after userRegistry initializes
  const [checkDelegateOnChain, setCheckDelegateOnChain] = useState<
    ((delegateAddress: string) => Promise<boolean>) | undefined
  >(undefined);

  // App wallet (supports both modes)
  const appWallet = useAppWallet({
    userAddress: walletMode === 'browser' ? browserWallet.address : null,
    provider: walletMode === 'standalone' ? standaloneProvider : browserWallet.provider,
    mode: walletMode,
    checkDelegateOnChain,
  });

  // Centralized wallet configuration - compute all wallet-related values in one place
  const walletConfig = useMemo(() => {
    const isStandalone = walletMode === 'standalone';
    const isBrowser = walletMode === 'browser';

    // Always use standalone provider for reads (always available via RPC)
    // This allows browsing without wallet connection
    const activeProvider = standaloneProvider;

    // Active address only when explicitly connected (not when walletMode is 'none')
    // This prevents MetaMask auto-connect from showing user as connected after disconnect
    const activeAddress = isStandalone
      ? appWallet.appWalletAddress
      : isBrowser
        ? browserWallet.address
        : null;

    // Can read data (just need a provider - always true)
    const canRead = !!standaloneProvider;

    // Can write (need active address + potentially signer)
    const canWrite = isStandalone
      ? appWallet.isReady && !!appWallet.appWallet
      : isBrowser
        ? !!browserWallet.address
        : false;

    // Signer for delegatable operations (posting messages, etc.):
    // - Standalone mode: always use in-app wallet
    // - Browser mode + authorized: use in-app wallet (gasless)
    // - Browser mode + NOT authorized: null (falls back to browser wallet in createWriteContract)
    const signer = isStandalone
      ? appWallet.appWallet
      : (appWallet.isAuthorized ? appWallet.appWallet : null);

    // Profile signer - always the profile owner (not delegate):
    // - Standalone mode: in-app wallet IS the profile owner
    // - Browser mode: null (falls back to browser wallet signer via browserProvider)
    // This is needed for owner-only operations (profile creation, delegate management, display name, bio)
    const profileSigner = isStandalone ? appWallet.appWallet : null;

    // Browser provider - needed for profile operations to get browser wallet signer
    const browserProvider = isBrowser ? browserWallet.provider : null;

    return {
      activeProvider,
      activeAddress,
      signer,
      profileSigner,
      browserProvider,
      canRead,
      canWrite,
      isReady: canWrite, // Keep for backwards compat
      isStandalone,
      isBrowser,
    };
  }, [walletMode, standaloneProvider, browserWallet.address, browserWallet.provider, appWallet.appWalletAddress, appWallet.appWallet, appWallet.isReady, appWallet.isAuthorized]);

  // Channel registry - enabled for reading even without wallet
  const channelRegistry = useChannelRegistry({
    registryAddress,
    provider: walletConfig.activeProvider,
    signer: walletConfig.signer,
    enabled: !!registryAddress,
  });

  // User registry (get address from channel registry)
  const [userRegistryAddress, setUserRegistryAddress] = useState<string | null>(null);

  useEffect(() => {
    if (registryAddress && walletConfig.activeProvider) {
      channelRegistry.getUserRegistryAddress().then(setUserRegistryAddress).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryAddress, walletConfig.activeProvider]);

  // User registry - enabled for reading even without wallet
  const userRegistry = useUserRegistry({
    registryAddress: userRegistryAddress,
    provider: walletConfig.activeProvider,
    writeProvider: walletConfig.browserProvider, // Use browser provider for profile writes (to get signer)
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.profileSigner, // Use profile signer (not delegate) for owner-only operations
    delegateSigner: walletConfig.signer, // Use delegate signer for link operations (gasless)
    enabled: !!userRegistryAddress,
  });

  // Update the on-chain delegate check when userRegistry becomes available
  useEffect(() => {
    if (walletMode === 'browser' && userRegistry.isDelegate) {
      setCheckDelegateOnChain(() => userRegistry.isDelegate);
    } else if (walletMode !== 'browser') {
      setCheckDelegateOnChain(undefined);
    }
  }, [walletMode, userRegistry.isDelegate]);

  // Initialize standalone wallet if mode is standalone
  useEffect(() => {
    if (walletMode === 'standalone' && standaloneProvider && !appWallet.appWallet) {
      appWallet.initializeStandaloneWallet(standaloneProvider);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletMode, standaloneProvider, appWallet.appWallet]);

  // Refresh profile when wallet mode or active address changes
  useEffect(() => {
    if (walletConfig.activeAddress && walletConfig.activeProvider) {
      userRegistry.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletMode, walletConfig.activeAddress, walletConfig.activeProvider]);

  // Selected channel - URL param takes priority, then localStorage, then first available
  const [selectedChannel, setSelectedChannel] = useState<string | null>(() => {
    if (directChannelAddress) return directChannelAddress;
    return localStorage.getItem('selectedChannel');
  });

  // Use first channel if none selected and channels are available
  useEffect(() => {
    if (!selectedChannel && channelRegistry.channels.length > 0) {
      setSelectedChannel(channelRegistry.channels[0].channelAddress);
    }
  }, [selectedChannel, channelRegistry.channels]);

  // Persist selected channel
  useEffect(() => {
    if (selectedChannel) {
      localStorage.setItem('selectedChannel', selectedChannel);
    }
  }, [selectedChannel]);

  // DM-related state - URL param takes priority, then localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // URL params imply view mode
    if (directProfileAddress) return 'profile';
    if (directDMAddress) return 'dms';
    if (directThreadIndex) return 'forum';
    if (directChannelAddress) return 'channels';
    const stored = localStorage.getItem('viewMode') as ViewMode | null;
    if (stored === 'dms' || stored === 'profile' || stored === 'forum' || stored === 'channels') return stored;
    // Default to forum for new visitors
    return 'forum';
  });
  const [selectedConversation, setSelectedConversation] = useState<string | null>(() => {
    // URL dm param takes priority
    if (directDMAddress) return directDMAddress;
    return localStorage.getItem('selectedConversation');
  });

  // Profile view state
  const [selectedProfile, setSelectedProfile] = useState<string | null>(() => {
    if (directProfileAddress) return directProfileAddress;
    return localStorage.getItem('selectedProfile');
  });

  // Forum thread view state
  const [selectedThread, setSelectedThread] = useState<number | null>(() => {
    if (directThreadIndex) {
      const parsed = parseInt(directThreadIndex, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  });

  // User post view state (within profile view)
  const [selectedPost, setSelectedPost] = useState<number | null>(() => {
    if (directPostIndex) {
      const parsed = parseInt(directPostIndex, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  });

  // Page title context (passed up from child components or derived)
  const [currentThreadTitle, setCurrentThreadTitle] = useState<string | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState<string | null>(null);

  // Track last URL to prevent duplicate history entries
  const lastUrlRef = useRef<string>(window.location.href);

  // Sidebar expansion state
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const stored = localStorage.getItem('sidebarExpanded');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // ignore
      }
    }
    return { channels: true, dms: true, following: true };
  });

  const handleToggleSection = (section: SidebarSection) => {
    setSidebarExpanded((prev: Record<SidebarSection, boolean>) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Persist sidebar expansion
  useEffect(() => {
    localStorage.setItem('sidebarExpanded', JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  // Persist selected profile
  useEffect(() => {
    if (selectedProfile) {
      localStorage.setItem('selectedProfile', selectedProfile);
    }
  }, [selectedProfile]);

  // Fetch profile display name for page title
  useEffect(() => {
    if (selectedProfile && userRegistry.getProfile) {
      userRegistry.getProfile(selectedProfile)
        .then(profile => setCurrentProfileName(profile?.displayName || null))
        .catch(() => setCurrentProfileName(null));
    } else {
      setCurrentProfileName(null);
    }
  }, [selectedProfile, userRegistry.getProfile]);

  // DM other participant name for page title (also used in DM view)
  const [dmOtherParticipantName, setDmOtherParticipantName] = useState<string | null>(null);

  // Persist view mode and selected conversation
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (selectedConversation) {
      localStorage.setItem('selectedConversation', selectedConversation);
    }
  }, [selectedConversation]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const channel = urlParams.get('channel');
      const dm = urlParams.get('dm');
      const profile = urlParams.get('profile');
      const thread = urlParams.get('thread');
      const post = urlParams.get('post');

      // Update lastUrlRef to current URL to prevent re-pushing
      lastUrlRef.current = window.location.href;

      // Determine view mode and selections from URL
      if (thread !== null) {
        setViewMode('forum');
        setSelectedThread(parseInt(thread, 10));
      } else if (profile) {
        setViewMode('profile');
        setSelectedProfile(profile);
        setSelectedPost(post ? parseInt(post, 10) : null);
      } else if (dm) {
        setViewMode('dms');
        setSelectedConversation(dm);
      } else if (channel) {
        setViewMode('channels');
        setSelectedChannel(channel);
      } else {
        // Default to forum when no specific view
        setViewMode('forum');
        setSelectedThread(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [dmOtherParticipant, setDmOtherParticipant] = useState<string | null>(null);
  const [dmOtherPublicKey, setDmOtherPublicKey] = useState<string | null>(null);

  // DM Registry hook - enabled for reading even without wallet
  const dmRegistry = useDMRegistry({
    registryAddress: dmRegistryAddress,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    enabled: !!dmRegistryAddress,
  });

  // Follow Registry hook - enabled for reading even without wallet
  const followRegistry = useFollowRegistry({
    registryAddress: followRegistryAddress,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    enabled: !!followRegistryAddress,
  });

  // Session keys hook (for encrypted DMs)
  const sessionKeys = useSessionKeys({
    setSessionPublicKeyOnChain: userRegistry.setSessionPublicKey,
    clearSessionPublicKeyOnChain: userRegistry.clearSessionPublicKey,
    getOnChainPublicKey: useCallback(
      () => userRegistry.getSessionPublicKey(walletConfig.activeAddress || ''),
      [userRegistry.getSessionPublicKey, walletConfig.activeAddress]
    ),
    enabled: walletConfig.isReady && !!userRegistryAddress,
  });

  // DM Conversation hook - enabled for reading even without wallet
  const dmConversation = useDMConversation({
    conversationAddress: selectedConversation,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    theirPublicKey: dmOtherPublicKey,
    enabled: viewMode === 'dms' && !!selectedConversation,
  });

  // Load other participant's info when conversation changes
  useEffect(() => {
    if (selectedConversation && dmConversation.participant1 && dmConversation.participant2) {
      const otherParticipant = dmConversation.participant1.toLowerCase() === walletConfig.activeAddress?.toLowerCase()
        ? dmConversation.participant2
        : dmConversation.participant1;
      setDmOtherParticipant(otherParticipant);

      // Load their public key (empty "0x" means no key set)
      userRegistry.getSessionPublicKey(otherParticipant)
        .then(key => setDmOtherPublicKey(key && key.length > 2 ? key : null))
        .catch(() => setDmOtherPublicKey(null));

      // Load their display name
      userRegistry.getProfile(otherParticipant)
        .then(profile => setDmOtherParticipantName(profile.exists ? profile.displayName : null))
        .catch(() => setDmOtherParticipantName(null));
    } else {
      setDmOtherParticipant(null);
      setDmOtherPublicKey(null);
      setDmOtherParticipantName(null);
    }
  }, [selectedConversation, dmConversation.participant1, dmConversation.participant2, walletConfig.activeAddress, userRegistry]);

  // Check if current user is a participant in the selected DM conversation
  const isCurrentUserDMParticipant = useMemo(() => {
    if (!selectedConversation || !walletConfig.activeAddress) return true; // Default to true when no data
    if (!dmConversation.participant1 || !dmConversation.participant2) return true; // Still loading
    const addr = walletConfig.activeAddress.toLowerCase();
    return (
      dmConversation.participant1.toLowerCase() === addr ||
      dmConversation.participant2.toLowerCase() === addr
    );
  }, [selectedConversation, walletConfig.activeAddress, dmConversation.participant1, dmConversation.participant2]);

  // State for both participant names (when user is not a participant)
  const [dmBothParticipantNames, setDmBothParticipantNames] = useState<{ name1: string; name2: string } | null>(null);

  // Fetch both participant names when viewing DM as non-participant
  useEffect(() => {
    if (!isCurrentUserDMParticipant && dmConversation.participant1 && dmConversation.participant2) {
      Promise.all([
        userRegistry.getProfile(dmConversation.participant1),
        userRegistry.getProfile(dmConversation.participant2)
      ]).then(([profile1, profile2]) => {
        setDmBothParticipantNames({
          name1: profile1.exists ? profile1.displayName : truncateAddress(dmConversation.participant1!),
          name2: profile2.exists ? profile2.displayName : truncateAddress(dmConversation.participant2!)
        });
      }).catch(() => {
        setDmBothParticipantNames({
          name1: truncateAddress(dmConversation.participant1!),
          name2: truncateAddress(dmConversation.participant2!)
        });
      });
    } else {
      setDmBothParticipantNames(null);
    }
  }, [isCurrentUserDMParticipant, dmConversation.participant1, dmConversation.participant2, userRegistry]);

  // Auto-initialize session key when entering DMs
  useEffect(() => {
    if (viewMode === 'dms' && walletConfig.isReady && !sessionKeys.hasLocalKey && userRegistry.profile?.exists) {
      const toastId = toast.loading('Setting up encrypted messaging...');
      sessionKeys.initializeSessionKey()
        .then(() => toast.success('Encrypted messaging ready!', { id: toastId }))
        .catch(() => toast.error('Failed to setup encryption', { id: toastId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, walletConfig.isReady, sessionKeys.hasLocalKey, userRegistry.profile?.exists]);

  // Auto-create profile + session key for standalone wallet users
  useEffect(() => {
    const autoCreateProfile = async () => {
      // Only for standalone mode, when wallet is ready, and no profile exists
      if (walletMode !== 'standalone' || !walletConfig.isReady) return;
      if (userRegistry.isLoading) return; // Wait for profile check to complete
      if (userRegistry.profile === null) return; // Still loading
      if (userRegistry.profile.exists) return; // Already has profile

      const toastId = toast.loading('Setting up your profile...');
      try {
        await userRegistry.createDefaultProfile();
        toast.success('Profile created!', { id: toastId });

        // Also initialize session key for encrypted DMs
        if (!sessionKeys.hasLocalKey) {
          await sessionKeys.initializeSessionKey();
        }
      } catch (err) {
        toast.error('Failed to create profile', { id: toastId });
        console.error('Auto-profile creation failed:', err);
      }
    };

    autoCreateProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletMode, walletConfig.isReady, userRegistry.isLoading, userRegistry.profile, sessionKeys.hasLocalKey]);

  // Get display name helper - depends only on getProfile to avoid frequent recreation
  const getDisplayName = useCallback(async (address: string): Promise<string> => {
    try {
      const profile = await userRegistry.getProfile(address);
      return profile.exists ? profile.displayName : '';
    } catch {
      return '';
    }
  }, [userRegistry.getProfile]);

  // Current channel - only load when viewing channels
  const channel = useChannel({
    channelAddress: selectedChannel,
    provider: walletConfig.activeProvider,
    appWallet: walletConfig.signer,
    getDisplayName,
    enabled: viewMode === 'channels' && !!selectedChannel,
  });

  // Derive current channel name for page title (from loaded channel info)
  const currentChannelName = channel.channelInfo?.name || null;

  // Update URL and page title when navigation state changes
  useEffect(() => {
    const url = new URL(window.location.href);

    // Only include registry if config enabled or user originally provided it
    if (showRegistryInUrl) {
      if (registryAddress) url.searchParams.set('registry', registryAddress);
      if (dmRegistryAddress) url.searchParams.set('dmRegistry', dmRegistryAddress);
    } else {
      url.searchParams.delete('registry');
      url.searchParams.delete('dmRegistry');
    }

    // Set channel, dm, profile, or thread param based on view mode
    if (viewMode === 'channels' && selectedChannel) {
      url.searchParams.set('channel', selectedChannel);
      url.searchParams.delete('dm');
      url.searchParams.delete('profile');
      url.searchParams.delete('post');
      url.searchParams.delete('thread');
    } else if (viewMode === 'dms' && selectedConversation) {
      url.searchParams.set('dm', selectedConversation);
      url.searchParams.delete('channel');
      url.searchParams.delete('profile');
      url.searchParams.delete('post');
      url.searchParams.delete('thread');
    } else if (viewMode === 'profile' && selectedProfile) {
      url.searchParams.set('profile', selectedProfile);
      if (selectedPost !== null) {
        url.searchParams.set('post', String(selectedPost));
      } else {
        url.searchParams.delete('post');
      }
      url.searchParams.delete('channel');
      url.searchParams.delete('dm');
      url.searchParams.delete('thread');
    } else if (viewMode === 'forum') {
      if (selectedThread !== null) {
        url.searchParams.set('thread', String(selectedThread));
      } else {
        url.searchParams.delete('thread');
      }
      url.searchParams.delete('channel');
      url.searchParams.delete('dm');
      url.searchParams.delete('profile');
      url.searchParams.delete('post');
    } else {
      // No selection - remove all
      url.searchParams.delete('channel');
      url.searchParams.delete('dm');
      url.searchParams.delete('profile');
      url.searchParams.delete('post');
      url.searchParams.delete('thread');
    }

    // Determine page title
    let title = 'Plaza';
    if (viewMode === 'forum' && selectedThread !== null && currentThreadTitle) {
      title = `${currentThreadTitle} - Plaza`;
    } else if (viewMode === 'profile' && selectedProfile) {
      title = currentProfileName
        ? `${currentProfileName} - Profile - Plaza`
        : 'Profile - Plaza';
    } else if (viewMode === 'channels') {
      title = currentChannelName
        ? `${currentChannelName} - Chat - Plaza`
        : 'Chat - Plaza';
    } else if (viewMode === 'dms') {
      title = dmOtherParticipantName
        ? `${dmOtherParticipantName} - Messages - Plaza`
        : 'Messages - Plaza';
    } else if (viewMode === 'forum') {
      title = 'Forum - Plaza';
    }

    // Update page title
    document.title = title;

    // Push to history if URL changed (use pushState for history entries)
    const newUrl = url.toString();
    if (newUrl !== lastUrlRef.current) {
      window.history.pushState({}, title, newUrl);
      lastUrlRef.current = newUrl;
    }
  }, [viewMode, selectedChannel, selectedConversation, selectedProfile, selectedPost, selectedThread, currentThreadTitle, currentProfileName, currentChannelName, dmOtherParticipantName, showRegistryInUrl, registryAddress, dmRegistryAddress]);

  // Modals
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [canManageChannel, setCanManageChannel] = useState(false);
  const [showWalletChoiceModal, setShowWalletChoiceModal] = useState(false);
  const [showInAppSetup, setShowInAppSetup] = useState(false);
  const [showExportKeyModal, setShowExportKeyModal] = useState(false);
  const [showLinkBrowserModal, setShowLinkBrowserModal] = useState(false);
  const [tipTargetAddress, setTipTargetAddress] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Handler to navigate to profile (click navigates, tooltip shows on hover)
  const openProfile = useCallback((address: string | null) => {
    if (address) {
      setSelectedProfile(address);
      setSelectedPost(null); // Clear post selection when changing profiles
      setViewMode('profile');
    }
  }, []);

  // Helper to check if wallet is connected before write actions
  // Shows wallet modal if not connected, returns false
  const requireWallet = useCallback((): boolean => {
    if (!walletConfig.canWrite) {
      setShowWalletChoiceModal(true);
      return false;
    }
    return true;
  }, [walletConfig.canWrite]);

  // Track if user explicitly initiated browser wallet connection (to avoid showing modal on page load)
  const [pendingBrowserLink, setPendingBrowserLink] = useState(false);

  // Check if user can manage the current channel
  useEffect(() => {
    const checkManagePermission = async () => {
      if (!channel.channelInfo || !walletConfig.activeAddress) {
        setCanManageChannel(false);
        return;
      }

      // Owner can always manage
      if (channel.channelInfo.owner.toLowerCase() === walletConfig.activeAddress.toLowerCase()) {
        setCanManageChannel(true);
        return;
      }

      // Check if user is an admin
      try {
        const admin = await channel.isAdmin(walletConfig.activeAddress);
        setCanManageChannel(admin);
      } catch {
        setCanManageChannel(false);
      }
    };

    checkManagePermission();
  }, [channel.channelInfo, walletConfig.activeAddress, channel.isAdmin]);

  // Note: We no longer force the wallet modal on app load.
  // Users can browse freely. The modal only appears when they attempt a write action.

  // Check if MetaMask is available
  const hasMetaMask = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';

  // Show profile creation banner - browser mode, connected, but no profile yet
  const showCreateProfileBanner = walletMode === 'browser'
    && browserWallet.address
    && userRegistry.profile !== null  // Done loading
    && !userRegistry.profile.exists;   // No profile yet

  // Show session account setup banner (optional for gasless messaging) - only in browser mode
  // Don't show while checking authorization on-chain
  const showAppWalletBanner = walletMode === 'browser'
    && browserWallet.address
    && userRegistry.profile?.exists
    && !appWallet.isAuthorized
    && !appWallet.isCheckingAuth;

  // Show profile setup banner - standalone mode, has profile but not customized yet
  const showSetupProfileBanner = walletMode === 'standalone'
    && appWallet.isReady
    && userRegistry.profile?.exists
    && !userRegistry.profile.bio;  // Empty bio = not customized

  // Detect when browser wallet connects in standalone mode (for linking)
  // Only show modal if user explicitly initiated the connection (pendingBrowserLink)
  useEffect(() => {
    if (walletMode === 'standalone' && browserWallet.address && pendingBrowserLink) {
      setShowLinkBrowserModal(true);
      setPendingBrowserLink(false);
    }
  }, [walletMode, browserWallet.address, pendingBrowserLink]);

  // Send message handler with auto-profile creation
  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    if (!requireWallet()) return false;

    setIsSending(true);
    try {
      // Auto-create profile if user doesn't have one
      if (!userRegistry.profile?.exists) {
        const toastId = toast.loading('Creating profile...');
        try {
          await userRegistry.createDefaultProfile();
          toast.success('Profile created!', { id: toastId });

          // Also initialize session key for encrypted DMs
          if (!sessionKeys.hasLocalKey) {
            await sessionKeys.initializeSessionKey();
          }
        } catch (err) {
          toast.error('Failed to create profile', { id: toastId });
          throw err;
        }
      }

      await channel.postMessage(content);
      return true;
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    } finally {
      setIsSending(false);
    }
  };

  // Create channel handler
  const handleCreateChannel = async (name: string, description: string, postingMode: PostingMode) => {
    if (!requireWallet()) throw new Error('Wallet connection required');
    const result = await channelRegistry.createChannel(name, description, postingMode);
    setSelectedChannel(result.channelAddress);
    return result;
  };

  const handleCreateUnlistedChannel = async (name: string, description: string) => {
    if (!requireWallet()) throw new Error('Wallet connection required');
    const result = await channelRegistry.deployUnlistedChannel(name, description);
    setSelectedChannel(result.channelAddress);
    return result;
  };

  // Start DM conversation handler
  const handleStartDM = async (otherUserAddress: string) => {
    if (!requireWallet()) return;
    if (!walletConfig.activeAddress) return;

    try {
      // Check if conversation already exists
      const existingConv = await dmRegistry.getConversation(
        walletConfig.activeAddress,
        otherUserAddress
      );

      if (existingConv && existingConv !== ethers.ZeroAddress) {
        setSelectedConversation(existingConv);
      } else {
        // Create new conversation
        const toastId = toast.loading('Creating conversation...');
        try {
          const newConvAddress = await dmRegistry.createConversation(otherUserAddress);
          setSelectedConversation(newConvAddress);
          toast.success('Conversation created!', { id: toastId });
        } catch (err) {
          toast.error('Failed to create conversation', { id: toastId });
          throw err;
        }
      }

      setViewMode('dms');
      setShowNewDMModal(false);
    } catch (err) {
      console.error('Failed to start DM:', err);
    }
  };

  // Send DM message handler
  const handleSendDMMessage = async (content: string) => {
    if (!requireWallet()) return;
    // Auto-create profile if user doesn't have one
    if (!userRegistry.profile?.exists) {
      const toastId = toast.loading('Creating profile...');
      try {
        await userRegistry.createDefaultProfile();
        toast.success('Profile created!', { id: toastId });

        // Also initialize session key for encrypted DMs
        if (!sessionKeys.hasLocalKey) {
          await sessionKeys.initializeSessionKey();
        }
      } catch (err) {
        toast.error('Failed to create profile', { id: toastId });
        throw err;
      }
    }

    await dmConversation.sendMessage(content);
  };

  // Setup in-app wallet handler (authorize + fund)
  const handleSetupAppWallet = async () => {
    await appWallet.authorizeDelegate(userRegistry.addDelegate);
  };

  // Wallet choice handlers
  const handleSelectBrowserWallet = async () => {
    setShowWalletChoiceModal(false);
    setWalletMode('browser');
    await browserWallet.connect();
  };

  const handleSelectInAppWallet = () => {
    setShowWalletChoiceModal(false);
    setShowInAppSetup(true);
    // Initialize the standalone wallet
    appWallet.initializeStandaloneWallet(standaloneProvider);
  };

  const handleInAppSetupContinue = () => {
    setShowInAppSetup(false);
    setWalletMode('standalone');
  };

  const handleInAppSetupBack = () => {
    setShowInAppSetup(false);
    setShowWalletChoiceModal(true);
  };

  // Link browser wallet handlers
  const handleAddBrowserAsDelegate = async () => {
    if (!browserWallet.address) return;
    await userRegistry.addDelegate(browserWallet.address);
  };

  const handleTransferOwnership = async () => {
    if (!browserWallet.address) return;
    await userRegistry.transferProfileOwnership(browserWallet.address);
    // After transfer, switch to browser mode (useEffect will refresh profile)
    setWalletMode('browser');
    setShowLinkBrowserModal(false);
  };

  const handleSwitchToBrowser = () => {
    // Simply switch to browser wallet mode (abandon in-app wallet)
    setWalletMode('browser');
    setShowLinkBrowserModal(false);
  };

  // Determine if user can post
  const canPost = !!walletConfig.activeAddress;

  return (
    <div className="h-screen bg-black flex flex-col scanline">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--color-bg-primary)',
            color: 'var(--color-primary-500)',
            border: '1px solid var(--color-primary-500)',
            fontFamily: "'IBM Plex Mono', monospace",
            boxShadow: '0 0 20px rgba(255, 136, 0, calc(0.5 * var(--enable-glow)))',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-primary-500)',
              secondary: 'var(--color-bg-primary)'
            },
          },
          error: {
            style: {
              background: '#1a0000',
              color: 'var(--color-error)',
              border: '1px solid var(--color-error)',
              boxShadow: '0 0 20px rgba(220, 38, 38, calc(0.5 * var(--enable-glow)))',
            },
            iconTheme: {
              primary: 'var(--color-error)',
              secondary: '#1a0000'
            },
          },
          loading: {
            iconTheme: {
              primary: 'var(--color-accent-400)',
              secondary: 'var(--color-bg-accent)'
            },
          },
        }}
      />

      {/* Header */}
      <header className="border-b-2 border-primary-500 bg-black">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => {
              setViewMode('forum');
              setSelectedThread(0);
            }}
            className="flex items-baseline gap-4 hover:opacity-80 transition-opacity"
          >
            <h1 className="text-2xl font-bold text-primary-500 text-shadow-neon">
              PLAZA
            </h1>
            <span className="text-sm text-accent-400 text-shadow-neon-sm font-mono">
              DECENTRALIZED SOCIAL {walletMode === 'standalone' && '(IN-APP WALLET)'}
            </span>
          </button>
          <AccountButton
            walletAddress={walletConfig.activeAddress}
            isConnecting={browserWallet.isConnecting}
            onConnect={() => setShowWalletChoiceModal(true)}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar with channels, DMs, and following */}
        {registryAddress && (
          <Sidebar
            channels={channelRegistry.channels}
            selectedChannel={selectedChannel}
            onSelectChannel={(addr) => {
              setSelectedChannel(addr);
              setViewMode('channels');
            }}
            onCreateChannel={() => setShowCreateChannelModal(true)}
            provider={walletConfig.activeProvider}
            isConnected={!!walletConfig.activeAddress}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            dmConversations={dmRegistry.conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            onNewDM={() => setShowNewDMModal(true)}
            dmLoading={dmRegistry.isLoading}
            dmRegistryAvailable={!!dmRegistryAddress}
            getDisplayName={getDisplayName}
            following={followRegistry.following}
            selectedProfile={selectedProfile}
            onSelectProfile={setSelectedProfile}
            followRegistryAvailable={!!followRegistryAddress}
            sidebarExpanded={sidebarExpanded}
            onToggleSection={handleToggleSection}
            currentUserAddress={walletConfig.activeAddress}
            currentUserDisplayName={userRegistry.profile?.displayName || null}
            onConnectWallet={() => setShowWalletChoiceModal(true)}
            forumAvailable={!!forumThreadAddress}
          />
        )}

        {/* Main content area (chat + user list) - wrapped for profile overlay */}
        <div className="flex-1 flex relative">
          {/* Chat area */}
          <div className="flex-1 flex flex-col bg-black">
          {/* No registry warning */}
          {!registryAddress && !directChannelAddress && (
            <div className="border-b-2 border-yellow-500 bg-yellow-950 bg-opacity-20 p-4">
              <div className="flex items-center font-mono">
                <span className="text-yellow-500 mr-3 text-xl">!</span>
                <div>
                  <p className="text-yellow-400 text-sm">NO REGISTRY SPECIFIED</p>
                  <p className="text-yellow-600 text-xs mt-1">
                    Add <code className="text-yellow-400">?registry=0x...</code> to URL
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Profile creation banner */}
          {showCreateProfileBanner && (
            <div className="border-b-2 border-accent-500 bg-accent-950 bg-opacity-20 p-4">
              <div className="flex items-center justify-between font-mono">
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">i</span>
                  <span className="text-accent-400 text-sm">Create a profile to start posting</span>
                </div>
                <button
                  onClick={() => setViewMode('settings')}
                  className="px-4 py-1 bg-accent-900 text-accent-400 border border-accent-500 text-sm"
                >
                  CREATE PROFILE
                </button>
              </div>
            </div>
          )}

          {/* Session account setup banner (optional for gasless messaging) */}
          {showAppWalletBanner && (
            <div className="border-b-2 border-accent-500 bg-accent-950 bg-opacity-20 p-4">
              <div className="flex items-center justify-between font-mono">
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">i</span>
                  <span className="text-accent-400 text-sm">Set up session account for gasless messaging</span>
                </div>
                <button
                  onClick={() => setViewMode('settings')}
                  className="px-4 py-1 bg-accent-900 text-accent-400 border border-accent-500 text-sm"
                >
                  SETUP SESSION ACCOUNT
                </button>
              </div>
            </div>
          )}

          {/* Profile setup banner for standalone users */}
          {showSetupProfileBanner && (
            <div className="border-b-2 border-accent-500 bg-accent-950 bg-opacity-20 p-4">
              <div className="flex items-center justify-between font-mono">
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">i</span>
                  <span className="text-accent-400 text-sm">Set up your profile with a username and bio</span>
                </div>
                <button
                  onClick={() => setViewMode('settings')}
                  className="px-4 py-1 bg-accent-900 text-accent-400 border border-accent-500 text-sm"
                >
                  SET UP PROFILE
                </button>
              </div>
            </div>
          )}

          {/* Error display */}
          {(browserWallet.error || channel.error || userRegistry.error) && (
            <div className="border-b-2 border-red-500 bg-red-950 bg-opacity-20 p-4">
              <div className="flex items-center font-mono">
                <span className="text-red-500 mr-3">X</span>
                <p className="text-red-400 text-sm">
                  {browserWallet.error || channel.error || userRegistry.error}
                </p>
              </div>
            </div>
          )}

          {/* Conditional content based on view mode */}
          {viewMode === 'channels' ? (
            <>
              {/* Channel header */}
              <ChannelHeader
                channelInfo={channel.channelInfo}
                isLoading={channel.isLoading && !channel.channelInfo}
                canManage={canManageChannel}
                onManageClick={() => setShowModerationModal(true)}
              />

              {/* Chat feed */}
              <ChatFeed
                messages={channel.messages}
                isLoading={channel.isLoading && channel.messages.length === 0}
                currentAddress={walletConfig.activeAddress}
                currentUserDisplayName={userRegistry.profile?.displayName}
                onSelectUser={openProfile}
                getProfile={userRegistry.getProfile}
                provider={walletConfig.activeProvider}
                onStartDM={dmRegistryAddress ? handleStartDM : undefined}
                canSendDM={!!userRegistry.profile && sessionKeys.hasLocalKey}
                onFollow={followRegistry.follow}
                onUnfollow={followRegistry.unfollow}
                isFollowing={followRegistry.isFollowingSync}
                onTip={setTipTargetAddress}
                canTip={!!(walletConfig.signer || walletConfig.browserProvider)}
              />

              {/* Message input */}
              <MessageInput
                onSend={handleSendMessage}
                disabled={!canPost}
                isSending={isSending}
                onConnectWallet={() => setShowWalletChoiceModal(true)}
              />
            </>
          ) : viewMode === 'dms' ? (
            // DM conversation view
            selectedConversation ? (
              <DMConversationView
                messages={dmConversation.messages}
                isLoading={dmConversation.isLoading}
                isSending={dmConversation.isSending}
                onSendMessage={handleSendDMMessage}
                otherParticipantName={dmOtherParticipantName}
                otherParticipantAddress={dmOtherParticipant || ''}
                canSend={!!dmOtherPublicKey && sessionKeys.hasLocalKey && !!walletConfig.activeAddress && isCurrentUserDMParticipant}
                noSessionKey={!dmOtherPublicKey}
                isParticipant={isCurrentUserDMParticipant}
                participantNames={dmBothParticipantNames}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-primary-600 font-mono text-lg mb-2">SELECT A CONVERSATION</p>
                  <p className="text-primary-700 font-mono text-sm">
                    Choose a conversation from the sidebar or start a new one
                  </p>
                </div>
              </div>
            )
          ) : viewMode === 'profile' ? (
            // Profile view
            <ProfileView
              userAddress={selectedProfile}
              currentUserAddress={walletConfig.activeAddress}
              getProfile={userRegistry.getProfile}
              onStartDM={dmRegistryAddress ? handleStartDM : undefined}
              dmRegistryAvailable={!!dmRegistryAddress}
              canSendDM={!!userRegistry.profile && sessionKeys.hasLocalKey}
              hasSessionPublicKey={userRegistry.hasSessionPublicKey}
              isFollowing={selectedProfile ? followRegistry.isFollowingSync(selectedProfile) : false}
              onFollow={followRegistry.follow}
              onUnfollow={followRegistry.unfollow}
              followLoading={followRegistry.isLoading}
              followerCount={followRegistry.followerCount}
              followingCount={followRegistry.followingCount}
              userPostsAddress={userPostsAddress}
              repliesAddress={repliesAddress}
              votingAddress={votingAddress}
              provider={walletConfig.activeProvider}
              signer={walletConfig.signer}
              getDisplayName={getDisplayName}
              onSelectUser={openProfile}
              getLinks={userRegistry.getLinks}
              onUpdateDisplayName={userRegistry.updateDisplayName}
              onUpdateBio={userRegistry.updateBio}
              onAddLink={userRegistry.addLink}
              onRemoveLink={userRegistry.removeLink}
              sessionWallet={walletConfig.signer}
              sessionWalletAddress={appWallet.appWalletAddress}
              sessionWalletBalance={appWallet.balance}
              browserProvider={walletConfig.browserProvider}
              browserWalletAddress={browserWallet.address}
              isFollowingUser={followRegistry.isFollowingSync}
              onTip={setTipTargetAddress}
              canTip={!!walletConfig.signer || !!walletConfig.browserProvider}
              onConnectWallet={() => setShowWalletChoiceModal(true)}
              selectedPostFromUrl={selectedPost}
              onPostChange={setSelectedPost}
            />
          ) : viewMode === 'forum' ? (
            // Forum view (public threads)
            <ForumView
              forumThreadAddress={forumThreadAddress}
              repliesAddress={repliesAddress}
              votingAddress={votingAddress}
              userRegistryAddress={userRegistryAddress}
              provider={walletConfig.activeProvider}
              signer={walletConfig.signer}
              currentAddress={walletConfig.activeAddress}
              getDisplayName={getDisplayName}
              onSelectUser={openProfile}
              disabled={!walletConfig.canWrite}
              selectedThreadFromUrl={selectedThread}
              onThreadChange={setSelectedThread}
              onThreadTitleChange={setCurrentThreadTitle}
              getProfile={userRegistry.getProfile}
              onStartDM={dmRegistryAddress ? handleStartDM : undefined}
              canSendDM={!!userRegistry.profile && sessionKeys.hasLocalKey}
              onFollow={followRegistry.follow}
              onUnfollow={followRegistry.unfollow}
              isFollowing={followRegistry.isFollowingSync}
              onTip={setTipTargetAddress}
              canTip={!!walletConfig.signer || !!walletConfig.browserProvider}
            />
          ) : viewMode === 'settings' ? (
            // Settings view
            <SettingsView
              walletAddress={walletConfig.activeAddress}
              isConnecting={browserWallet.isConnecting}
              onConnect={() => setShowWalletChoiceModal(true)}
              onDisconnect={() => {
                browserWallet.disconnect();
                appWallet.disconnect();
                setWalletMode('none');
                // Switch to channels view so user can continue browsing as guest
                setViewMode('channels');
              }}
              profile={userRegistry.profile}
              onCreateProfile={userRegistry.createProfile}
              appWalletAddress={appWallet.appWalletAddress}
              appWalletBalance={appWallet.balance}
              isAuthorized={appWallet.isAuthorized}
              onSetupAppWallet={handleSetupAppWallet}
              onTopUp={appWallet.fundWallet}
              walletMode={walletMode}
              onExportPrivateKey={() => setShowExportKeyModal(true)}
              onConnectBrowserWallet={() => {
                setPendingBrowserLink(true);
                browserWallet.connect();
              }}
              onUpdateDisplayName={userRegistry.updateDisplayName}
              onUpdateBio={userRegistry.updateBio}
            />
          ) : null}
          </div>

          {/* User list panel (only for channels) */}
          {viewMode === 'channels' && selectedChannel && (
            <UserListPanel
              messages={channel.messages}
              currentAddress={walletConfig.activeAddress}
              currentUserDisplayName={userRegistry.profile?.displayName}
              onSelectUser={openProfile}
              getProfile={userRegistry.getProfile}
              provider={walletConfig.activeProvider}
              onStartDM={dmRegistryAddress ? handleStartDM : undefined}
              canSendDM={!!userRegistry.profile && sessionKeys.hasLocalKey}
              onFollow={followRegistry.follow}
              onUnfollow={followRegistry.unfollow}
              isFollowing={followRegistry.isFollowingSync}
              onTip={setTipTargetAddress}
              canTip={!!(walletConfig.signer || walletConfig.browserProvider)}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <WalletChoiceModal
        isOpen={showWalletChoiceModal}
        onSelectBrowser={handleSelectBrowserWallet}
        onSelectInApp={handleSelectInAppWallet}
        hasMetaMask={hasMetaMask}
        onClose={() => setShowWalletChoiceModal(false)}
      />

      <SessionAccountSetup
        isOpen={showInAppSetup}
        walletAddress={appWallet.appWalletAddress || ''}
        balance={appWallet.balance}
        onContinue={handleInAppSetupContinue}
        onRefreshBalance={appWallet.refreshBalance}
        onBack={handleInAppSetupBack}
      />

      <PrivateKeyExportModal
        isOpen={showExportKeyModal}
        onClose={() => setShowExportKeyModal(false)}
        privateKey={appWallet.getPrivateKey() || ''}
      />

      <LinkBrowserWalletModal
        isOpen={showLinkBrowserModal}
        onClose={() => setShowLinkBrowserModal(false)}
        inAppAddress={appWallet.appWalletAddress || ''}
        browserAddress={browserWallet.address || ''}
        inAppHasProfile={userRegistry.profile?.exists ?? false}
        checkBrowserHasProfile={() => userRegistry.hasProfile(browserWallet.address || '')}
        onAddAsDelegate={handleAddBrowserAsDelegate}
        onTransferOwnership={handleTransferOwnership}
        onSwitchToBrowser={handleSwitchToBrowser}
      />

      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onCreate={handleCreateChannel}
        onCreateUnlisted={handleCreateUnlistedChannel}
      />

      <ChannelModerationModal
        isOpen={showModerationModal}
        onClose={() => setShowModerationModal(false)}
        channelInfo={channel.channelInfo}
        currentUserAddress={walletConfig.activeAddress}
        addAllowedPoster={channel.addAllowedPoster}
        removeAllowedPoster={channel.removeAllowedPoster}
        promoteAdmin={channel.promoteAdmin}
        demoteAdmin={channel.demoteAdmin}
        transferOwnership={channel.transferOwnership}
        setPostingMode={channel.setPostingMode}
      />

      <NewDMModal
        isOpen={showNewDMModal}
        onClose={() => setShowNewDMModal(false)}
        onCreateConversation={dmRegistry.createConversation}
        checkConversationExists={dmRegistry.conversationExists}
        getExistingConversation={dmRegistry.getConversation}
        userAddress={walletConfig.activeAddress}
      />

      {/* Tip Modal (triggered from tooltip) */}
      {tipTargetAddress && (
        <TipModal
          isOpen={true}
          onClose={() => setTipTargetAddress(null)}
          recipientAddress={tipTargetAddress}
          sessionWallet={walletConfig.signer}
          sessionWalletAddress={appWallet.appWalletAddress}
          sessionWalletBalance={appWallet.balance}
          browserProvider={walletConfig.browserProvider}
          browserWalletAddress={browserWallet.address}
          onConnectWallet={() => setShowWalletChoiceModal(true)}
        />
      )}

      </div>
  );
}

export default App;
