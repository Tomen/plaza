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
import { hasStandaloneWallet } from './utils/appWallet';
import { AccountButton } from './components/AccountButton';
import { AccountModal } from './components/AccountModal';
import { ChatFeed } from './components/ChatFeed';
import { MessageInput } from './components/MessageInput';
import { Sidebar, type ViewMode } from './components/Sidebar';
import { ChannelHeader } from './components/ChannelHeader';
import { UserListPanel } from './components/UserListPanel';
import { UserProfileModal } from './components/UserProfileModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { WalletChoiceModal } from './components/WalletChoiceModal';
import { InAppWalletSetup } from './components/InAppWalletSetup';
import { PrivateKeyExportModal } from './components/PrivateKeyExportModal';
import { LinkBrowserWalletModal } from './components/LinkBrowserWalletModal';
import { DMConversationView } from './components/DMConversationView';
import { NewDMModal } from './components/NewDMModal';
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
  const directChannelAddress = urlParams.get('channel');

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

    // Determine the signer for write operations
    const activeSigner = isStandalone ? appWallet.appWallet : null;

    // Determine if the wallet system is ready for operations
    const isReady = isStandalone
      ? appWallet.isReady && !!appWallet.appWallet
      : isBrowser
        ? !!browserWallet.address
        : false;

    // Channel wallet: in standalone mode always use app wallet; in browser mode only if authorized
    const channelSigner = isStandalone
      ? appWallet.appWallet
      : (appWallet.isAuthorized ? appWallet.appWallet : null);

    return {
      activeProvider,
      activeAddress,
      activeSigner,
      channelSigner,
      isReady,
      isStandalone,
      isBrowser,
    };
  }, [walletMode, standaloneProvider, browserWallet.provider, browserWallet.address, appWallet.appWalletAddress, appWallet.appWallet, appWallet.isReady, appWallet.isAuthorized]);

  // Channel registry
  const channelRegistry = useChannelRegistry({
    registryAddress,
    provider: walletConfig.activeProvider,
    signer: walletConfig.activeSigner,
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
    signer: walletConfig.activeSigner,
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

  // DM-related state - restore from localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem('viewMode') as ViewMode | null;
    return stored === 'dms' ? 'dms' : 'channels';
  });
  const [selectedConversation, setSelectedConversation] = useState<string | null>(() => {
    return localStorage.getItem('selectedConversation');
  });

  // Persist view mode and selected conversation
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (selectedConversation) {
      localStorage.setItem('selectedConversation', selectedConversation);
    }
  }, [selectedConversation]);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [dmOtherParticipant, setDmOtherParticipant] = useState<string | null>(null);
  const [dmOtherPublicKey, setDmOtherPublicKey] = useState<string | null>(null);
  const [dmOtherParticipantName, setDmOtherParticipantName] = useState<string | null>(null);

  // DM Registry hook
  const dmRegistry = useDMRegistry({
    registryAddress: dmRegistryAddress,
    provider: walletConfig.activeProvider,
    userAddress: walletConfig.activeAddress,
    signer: walletConfig.channelSigner,
    enabled: walletConfig.isReady && !!dmRegistryAddress,
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
    signer: walletConfig.channelSigner,
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

  // Get display name helper
  const getDisplayName = useCallback(async (address: string): Promise<string> => {
    try {
      const profile = await userRegistry.getProfile(address);
      return profile.exists ? profile.displayName : '';
    } catch {
      return '';
    }
  }, [userRegistry]);

  // Current channel
  const channel = useChannel({
    channelAddress: selectedChannel,
    provider: walletConfig.activeProvider,
    appWallet: walletConfig.channelSigner,
    getDisplayName,
    enabled: walletConfig.isReady,
  });

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showWalletChoiceModal, setShowWalletChoiceModal] = useState(walletMode === 'none');
  const [showInAppSetup, setShowInAppSetup] = useState(false);
  const [showExportKeyModal, setShowExportKeyModal] = useState(false);
  const [showLinkBrowserModal, setShowLinkBrowserModal] = useState(false);
  const [profileModalAddress, setProfileModalAddress] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Track if user explicitly initiated browser wallet connection (to avoid showing modal on page load)
  const [pendingBrowserLink, setPendingBrowserLink] = useState(false);

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
      // Close AccountModal so LinkBrowserWalletModal is visible
      setShowAccountModal(false);
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
              ON-CHAIN CHAT
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
            onOpenAccount={() => setShowAccountModal(true)}
            walletMode={walletMode}
          />
        </div>

        {/* Line 2: Subtitle */}
        <div className="px-4 pb-4">
          <p className="text-xs text-accent-400 text-shadow-neon-sm font-mono">
            DECENTRALIZED MESSAGING {walletMode === 'standalone' && '(IN-APP WALLET)'}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar with channels and DMs */}
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
          />
        )}

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
                  onClick={() => setShowAccountModal(true)}
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
              />

              {/* Chat feed */}
              <ChatFeed
                messages={channel.messages}
                isLoading={channel.isLoading && channel.messages.length === 0}
                currentAddress={walletConfig.activeAddress}
              />

              {/* Message input */}
              <MessageInput
                onSend={handleSendMessage}
                disabled={!canPost}
                isSending={isSending}
              />
            </>
          ) : (
            // DM conversation view
            selectedConversation ? (
              <DMConversationView
                messages={dmConversation.messages}
                isLoading={dmConversation.isLoading}
                isSending={dmConversation.isSending}
                onSendMessage={handleSendDMMessage}
                otherParticipantName={dmOtherParticipantName}
                otherParticipantAddress={dmOtherParticipant || ''}
                canSend={!!dmOtherPublicKey && sessionKeys.hasLocalKey && !!walletConfig.activeAddress}
                noSessionKey={!dmOtherPublicKey}
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
          )}
        </div>

        {/* User list panel (only for channels) */}
        {viewMode === 'channels' && selectedChannel && (
          <UserListPanel
            messages={channel.messages}
            currentAddress={walletConfig.activeAddress}
            onSelectUser={setProfileModalAddress}
          />
        )}
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

      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        walletAddress={walletConfig.activeAddress}
        isConnecting={browserWallet.isConnecting}
        onConnect={() => {
          setShowAccountModal(false);
          setShowWalletChoiceModal(true);
        }}
        onDisconnect={() => {
          browserWallet.disconnect();
          appWallet.disconnect();
          setWalletMode('none');
          setShowAccountModal(false);
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
      />

      <NewDMModal
        isOpen={showNewDMModal}
        onClose={() => setShowNewDMModal(false)}
        onCreateConversation={dmRegistry.createConversation}
        checkConversationExists={dmRegistry.conversationExists}
        getExistingConversation={dmRegistry.getConversation}
        userAddress={walletConfig.activeAddress}
      />

      <UserProfileModal
        isOpen={!!profileModalAddress}
        onClose={() => setProfileModalAddress(null)}
        userAddress={profileModalAddress}
        getProfile={userRegistry.getProfile}
        onStartDM={dmRegistryAddress ? handleStartDM : undefined}
        dmRegistryAvailable={!!dmRegistryAddress}
      />
    </div>
  );
}

export default App;
