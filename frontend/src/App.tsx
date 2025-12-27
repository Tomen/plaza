import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { UserProfileModal } from './components/UserProfileModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { WalletChoiceModal } from './components/WalletChoiceModal';
import { InAppWalletSetup } from './components/InAppWalletSetup';
import { PrivateKeyExportModal } from './components/PrivateKeyExportModal';
import { LinkBrowserWalletModal } from './components/LinkBrowserWalletModal';
import { DMConversationView } from './components/DMConversationView';
import { NewDMModal } from './components/NewDMModal';
import { SettingsView } from './components/SettingsView';
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
  const directChannelAddress = urlParams.get('channel');
  const directDMAddress = urlParams.get('dm');
  const directProfileAddress = urlParams.get('profile');

  // Track if user provided registry params in initial URL (for URL persistence)
  const [userProvidedRegistry] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('registry') || params.has('dmRegistry');
  });

  // Determine if we should show registry in URL based on config or user input
  const showRegistryInUrl = import.meta.env.VITE_SHOW_REGISTRY_IN_URL === 'true' || userProvidedRegistry;

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

    // Determine active provider and address based on mode
    const activeProvider = isStandalone ? standaloneProvider : browserWallet.provider;
    const activeAddress = isStandalone ? appWallet.appWalletAddress : browserWallet.address;

    // Determine if the wallet system is ready for operations
    const isReady = isStandalone
      ? appWallet.isReady && !!appWallet.appWallet
      : isBrowser
        ? !!browserWallet.address
        : false;

    // Single signer for all write operations:
    // - Standalone mode: always use in-app wallet
    // - Browser mode + authorized: use in-app wallet (gasless)
    // - Browser mode + NOT authorized: null (falls back to browser wallet in createWriteContract)
    const signer = isStandalone
      ? appWallet.appWallet
      : (appWallet.isAuthorized ? appWallet.appWallet : null);

    return {
      activeProvider,
      activeAddress,
      signer,
      isReady,
      isStandalone,
      isBrowser,
    };
  }, [walletMode, standaloneProvider, browserWallet.provider, browserWallet.address, appWallet.appWalletAddress, appWallet.appWallet, appWallet.isReady, appWallet.isAuthorized]);

  // Channel registry
  const channelRegistry = useChannelRegistry({
    registryAddress,
    provider: walletConfig.activeProvider,
    signer: walletConfig.signer,
    enabled: walletConfig.isReady,
  });

  // User registry (get address from channel registry)
  const [userRegistryAddress, setUserRegistryAddress] = useState<string | null>(null);

  useEffect(() => {
    if (registryAddress && walletConfig.activeProvider) {
      channelRegistry.getUserRegistryAddress().then(setUserRegistryAddress).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryAddress, walletConfig.activeProvider]);

  const userRegistry = useUserRegistry({
    registryAddress: userRegistryAddress,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    enabled: walletConfig.isReady,
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
    const stored = localStorage.getItem('viewMode') as ViewMode | null;
    if (stored === 'dms' || stored === 'profile') return stored;
    return 'channels';
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

  // Persist view mode and selected conversation
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (selectedConversation) {
      localStorage.setItem('selectedConversation', selectedConversation);
    }
  }, [selectedConversation]);

  // Update URL when channel/conversation selection changes
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

    // Set channel, dm, or profile param based on view mode
    if (viewMode === 'channels' && selectedChannel) {
      url.searchParams.set('channel', selectedChannel);
      url.searchParams.delete('dm');
      url.searchParams.delete('profile');
    } else if (viewMode === 'dms' && selectedConversation) {
      url.searchParams.set('dm', selectedConversation);
      url.searchParams.delete('channel');
      url.searchParams.delete('profile');
    } else if (viewMode === 'profile' && selectedProfile) {
      url.searchParams.set('profile', selectedProfile);
      url.searchParams.delete('channel');
      url.searchParams.delete('dm');
    } else {
      // No selection - remove all
      url.searchParams.delete('channel');
      url.searchParams.delete('dm');
      url.searchParams.delete('profile');
    }

    window.history.replaceState({}, '', url.toString());
  }, [viewMode, selectedChannel, selectedConversation, selectedProfile, showRegistryInUrl, registryAddress, dmRegistryAddress]);

  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [dmOtherParticipant, setDmOtherParticipant] = useState<string | null>(null);
  const [dmOtherPublicKey, setDmOtherPublicKey] = useState<string | null>(null);
  const [dmOtherParticipantName, setDmOtherParticipantName] = useState<string | null>(null);

  // DM Registry hook
  const dmRegistry = useDMRegistry({
    registryAddress: dmRegistryAddress,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    enabled: walletConfig.isReady && !!dmRegistryAddress,
  });

  // Follow Registry hook
  const followRegistry = useFollowRegistry({
    registryAddress: followRegistryAddress,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    enabled: walletConfig.isReady && !!followRegistryAddress,
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

  // DM Conversation hook (for selected conversation)
  const dmConversation = useDMConversation({
    conversationAddress: selectedConversation,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.signer,
    theirPublicKey: dmOtherPublicKey,
    enabled: walletConfig.isReady && viewMode === 'dms' && !!selectedConversation,
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
  }, [walletMode, walletConfig.isReady, userRegistry.profile, sessionKeys.hasLocalKey]);

  // Get display name helper - depends only on getProfile to avoid frequent recreation
  const getDisplayName = useCallback(async (address: string): Promise<string> => {
    try {
      const profile = await userRegistry.getProfile(address);
      return profile.exists ? profile.displayName : '';
    } catch {
      return '';
    }
  }, [userRegistry.getProfile]);

  // Current channel
  const channel = useChannel({
    channelAddress: selectedChannel,
    provider: walletConfig.activeProvider,
    appWallet: walletConfig.signer,
    getDisplayName,
    enabled: walletConfig.isReady,
  });

  // Modals
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [canManageChannel, setCanManageChannel] = useState(false);
  const [showWalletChoiceModal, setShowWalletChoiceModal] = useState(walletMode === 'none');
  const [showInAppSetup, setShowInAppSetup] = useState(false);
  const [showExportKeyModal, setShowExportKeyModal] = useState(false);
  const [showLinkBrowserModal, setShowLinkBrowserModal] = useState(false);
  const [profileModalAddress, setProfileModalAddress] = useState<string | null>(null);
  const [previousViewState, setPreviousViewState] = useState<{
    viewMode: ViewMode;
    channel: string | null;
    dmConvo: string | null;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Handler to open profile with URL update
  const openProfile = useCallback((address: string | null) => {
    if (address) {
      // Save current state before opening profile
      setPreviousViewState({
        viewMode,
        channel: selectedChannel,
        dmConvo: selectedConversation,
      });
      setProfileModalAddress(address);

      // Update URL to show profile
      const url = new URL(window.location.href);
      if (showRegistryInUrl) {
        if (registryAddress) url.searchParams.set('registry', registryAddress);
        if (dmRegistryAddress) url.searchParams.set('dmRegistry', dmRegistryAddress);
      }
      url.searchParams.set('profile', address);
      url.searchParams.delete('channel');
      url.searchParams.delete('dm');
      window.history.pushState({}, '', url.toString());
    } else {
      // Closing profile - restore previous URL
      if (previousViewState) {
        const url = new URL(window.location.href);
        if (showRegistryInUrl) {
          if (registryAddress) url.searchParams.set('registry', registryAddress);
          if (dmRegistryAddress) url.searchParams.set('dmRegistry', dmRegistryAddress);
        }
        url.searchParams.delete('profile');

        if (previousViewState.viewMode === 'channels' && previousViewState.channel) {
          url.searchParams.set('channel', previousViewState.channel);
        } else if (previousViewState.viewMode === 'dms' && previousViewState.dmConvo) {
          url.searchParams.set('dm', previousViewState.dmConvo);
        }
        window.history.pushState({}, '', url.toString());
        setPreviousViewState(null);
      }
      setProfileModalAddress(null);
    }
  }, [viewMode, selectedChannel, selectedConversation, previousViewState, showRegistryInUrl, registryAddress, dmRegistryAddress]);

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

  // Show wallet choice modal when not connected
  // This handles the case where walletMode is 'browser' but MetaMask isn't connected
  // Skip if in standalone mode (wallet initializes async) or if wallet is still initializing
  useEffect(() => {
    if (walletMode === 'standalone') {
      // Standalone wallet initializes async, don't show modal
      return;
    }
    // Wait for browser wallet to finish initial connection check
    if (!browserWallet.isInitialized) {
      return;
    }
    if (walletMode === 'browser' && !browserWallet.address && !browserWallet.isConnecting) {
      // Browser mode but not connected after initialization - show modal
      setShowWalletChoiceModal(true);
    }
  }, [walletMode, browserWallet.address, browserWallet.isConnecting, browserWallet.isInitialized]);

  // Check if MetaMask is available
  const hasMetaMask = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';

  // Show in-app wallet setup banner (optional for gasless messaging) - only in browser mode
  // Don't show while checking authorization on-chain
  const showAppWalletBanner = walletMode === 'browser'
    && browserWallet.address
    && userRegistry.profile?.exists
    && !appWallet.isAuthorized
    && !appWallet.isCheckingAuth;

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
    const result = await channelRegistry.createChannel(name, description, postingMode);
    setSelectedChannel(result.channelAddress);
    return result;
  };

  const handleCreateUnlistedChannel = async (name: string, description: string) => {
    const result = await channelRegistry.deployUnlistedChannel(name, description);
    setSelectedChannel(result.channelAddress);
    return result;
  };

  // Start DM conversation handler
  const handleStartDM = async (otherUserAddress: string) => {
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
        {/* Line 1: Branding + Account Button */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-primary-500 text-shadow-neon">
              PLAZA
            </h1>
          </div>
          <AccountButton
            walletAddress={walletConfig.activeAddress}
            isConnecting={browserWallet.isConnecting}
            onConnect={() => setShowWalletChoiceModal(true)}
            profileName={userRegistry.profile?.displayName || null}
            hasProfile={userRegistry.profile?.exists || false}
            isAuthorized={appWallet.isAuthorized}
            balance={appWallet.balance}
            onOpenAccount={() => setViewMode('settings')}
            walletMode={walletMode}
          />
        </div>

        {/* Line 2: Subtitle */}
        <div className="px-4 pb-4">
          <p className="text-xs text-accent-400 text-shadow-neon-sm font-mono">
            DECENTRALIZED SOCIAL {walletMode === 'standalone' && '(IN-APP WALLET)'}
          </p>
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

          {/* In-app wallet setup banner (optional for gasless messaging) */}
          {showAppWalletBanner && (
            <div className="border-b-2 border-accent-500 bg-accent-950 bg-opacity-20 p-4">
              <div className="flex items-center justify-between font-mono">
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">i</span>
                  <span className="text-accent-400 text-sm">Set up in-app wallet for gasless messaging</span>
                </div>
                <button
                  onClick={() => setViewMode('settings')}
                  className="px-4 py-1 bg-accent-900 text-accent-400 border border-accent-500 text-sm"
                >
                  SETUP IN-APP WALLET
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
              />

              {/* Message input */}
              <MessageInput
                onSend={handleSendMessage}
                disabled={!canPost}
                isSending={isSending}
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
              onSelectUser={setSelectedProfile}
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
                setShowWalletChoiceModal(true);
              }}
              profile={userRegistry.profile}
              onCreateProfile={userRegistry.createProfile}
              onUpdateDisplayName={userRegistry.updateDisplayName}
              onUpdateBio={userRegistry.updateBio}
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
              hasSessionKey={sessionKeys.hasLocalKey}
              onInitializeSessionKey={sessionKeys.initializeSessionKey}
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
            />
          )}

          {/* Inline profile overlay - covers full main area when active */}
          {profileModalAddress && (
            <div className="absolute inset-0 z-10 bg-black flex flex-col">
              <UserProfileModal
                isOpen={true}
                onClose={() => openProfile(null)}
                userAddress={profileModalAddress}
                currentUserAddress={walletConfig.activeAddress}
                getProfile={userRegistry.getProfile}
                onStartDM={dmRegistryAddress ? handleStartDM : undefined}
                dmRegistryAvailable={!!dmRegistryAddress}
                isFollowing={profileModalAddress ? followRegistry.isFollowingSync(profileModalAddress) : false}
                onFollow={followRegistry.follow}
                onUnfollow={followRegistry.unfollow}
                followRegistryAvailable={!!followRegistryAddress}
              />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <WalletChoiceModal
        isOpen={showWalletChoiceModal}
        onSelectBrowser={handleSelectBrowserWallet}
        onSelectInApp={handleSelectInAppWallet}
        hasMetaMask={hasMetaMask}
      />

      <InAppWalletSetup
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

      </div>
  );
}

export default App;
