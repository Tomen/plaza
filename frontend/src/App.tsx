import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import { useWallet } from './hooks/useWallet';
import { useChannelRegistry } from './hooks/useChannelRegistry';
import { useChannel } from './hooks/useChannel';
import { useUserRegistry } from './hooks/useUserRegistry';
import { useAppWallet } from './hooks/useAppWallet';
import { AccountButton } from './components/AccountButton';
import { AccountModal } from './components/AccountModal';
import { ChatFeed } from './components/ChatFeed';
import { MessageInput } from './components/MessageInput';
import { Sidebar } from './components/Sidebar';
import { ChannelHeader } from './components/ChannelHeader';
import { CreateChannelModal } from './components/CreateChannelModal';
import type { PostingMode } from './types/contracts';

function App() {
  // Get registry address from URL parameter (?registry=0x...)
  const urlParams = new URLSearchParams(window.location.search);
  const registryAddress = urlParams.get('registry');
  const directChannelAddress = urlParams.get('channel');

  // Wallet state
  const wallet = useWallet();

  // Channel registry
  const channelRegistry = useChannelRegistry({
    registryAddress,
    provider: wallet.provider,
  });

  // User registry (get address from channel registry)
  const [userRegistryAddress, setUserRegistryAddress] = useState<string | null>(null);

  useEffect(() => {
    if (registryAddress && wallet.provider) {
      channelRegistry.getUserRegistryAddress().then(setUserRegistryAddress).catch(() => {});
    }
  }, [registryAddress, wallet.provider, channelRegistry]);

  const userRegistry = useUserRegistry({
    registryAddress: userRegistryAddress,
    provider: wallet.provider,
    userAddress: wallet.address,
  });

  // App wallet for gasless messaging
  const appWallet = useAppWallet({
    userAddress: wallet.address,
    provider: wallet.provider,
    checkDelegateOnChain: userRegistry.isDelegate,
  });

  // Selected channel
  const [selectedChannel, setSelectedChannel] = useState<string | null>(directChannelAddress);

  // Use first channel if none selected and channels are available
  useEffect(() => {
    if (!selectedChannel && channelRegistry.channels.length > 0) {
      setSelectedChannel(channelRegistry.channels[0].channelAddress);
    }
  }, [selectedChannel, channelRegistry.channels]);

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
    provider: wallet.provider,
    appWallet: appWallet.isAuthorized ? appWallet.appWallet : null,
    getDisplayName,
  });

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Show in-app wallet setup banner (optional for gasless messaging)
  const showAppWalletBanner = wallet.address && userRegistry.profile?.exists && !appWallet.isAuthorized;

  // Send message handler
  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;

    setIsSending(true);
    try {
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

  // Setup in-app wallet handler (authorize + fund)
  const handleSetupAppWallet = async () => {
    await appWallet.authorizeDelegate(userRegistry.addDelegate);
  };

  // Determine if user can post (just need wallet connection)
  const canPost = !!wallet.address;

  return (
    <div className="min-h-screen bg-black flex flex-col scanline">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a0f00',
            color: '#ff8800',
            border: '1px solid #ff8800',
            fontFamily: "'IBM Plex Mono', monospace",
            boxShadow: '0 0 20px rgba(255, 136, 0, 0.5)',
          },
          success: {
            iconTheme: { primary: '#ff8800', secondary: '#1a0f00' },
          },
          error: {
            style: {
              background: '#1a0000',
              color: '#ff0055',
              border: '1px solid #ff0055',
              boxShadow: '0 0 20px rgba(255, 0, 85, 0.5)',
            },
            iconTheme: { primary: '#ff0055', secondary: '#1a0000' },
          },
          loading: {
            iconTheme: { primary: '#00ffff', secondary: '#001a1a' },
          },
        }}
      />

      {/* Header */}
      <header className="border-b-2 border-orange-500 bg-black">
        {/* Line 1: Branding + Account Button */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-orange-500 text-shadow-neon">
              ON-CHAIN CHAT
            </h1>
          </div>
          <AccountButton
            walletAddress={wallet.address}
            isConnecting={wallet.isConnecting}
            onConnect={wallet.connect}
            profileName={userRegistry.profile?.displayName || null}
            hasProfile={userRegistry.profile?.exists || false}
            isAuthorized={appWallet.isAuthorized}
            balance={appWallet.balance}
            onOpenAccount={() => setShowAccountModal(true)}
          />
        </div>

        {/* Line 2: Subtitle */}
        <div className="px-4 pb-4">
          <p className="text-xs text-cyan-400 text-shadow-neon-sm font-mono">
            DECENTRALIZED MESSAGING
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar with channels */}
        {registryAddress && (
          <Sidebar
            channels={channelRegistry.channels}
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
            onCreateChannel={() => setShowCreateChannelModal(true)}
            provider={wallet.provider}
            isConnected={!!wallet.address}
          />
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col border-2 border-orange-500 border-shadow-neon bg-black m-4">
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
            <div className="border-b-2 border-cyan-500 bg-cyan-950 bg-opacity-20 p-4">
              <div className="flex items-center justify-between font-mono">
                <div className="flex items-center">
                  <span className="text-cyan-500 mr-3">i</span>
                  <span className="text-cyan-400 text-sm">Set up in-app wallet for gasless messaging</span>
                </div>
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="px-4 py-1 bg-cyan-900 text-cyan-400 border border-cyan-500 text-sm"
                >
                  SETUP IN-APP WALLET
                </button>
              </div>
            </div>
          )}

          {/* Error display */}
          {(wallet.error || channel.error || userRegistry.error) && (
            <div className="border-b-2 border-red-500 bg-red-950 bg-opacity-20 p-4">
              <div className="flex items-center font-mono">
                <span className="text-red-500 mr-3">X</span>
                <p className="text-red-400 text-sm">
                  {wallet.error || channel.error || userRegistry.error}
                </p>
              </div>
            </div>
          )}

          {/* Channel header */}
          <ChannelHeader
            channelInfo={channel.channelInfo}
            isLoading={channel.isLoading && !channel.channelInfo}
          />

          {/* Chat feed */}
          <ChatFeed
            messages={channel.messages}
            isLoading={channel.isLoading && channel.messages.length === 0}
            currentAddress={wallet.address}
          />

          {/* Message input */}
          <MessageInput
            onSend={handleSendMessage}
            disabled={!canPost}
            isSending={isSending}
          />
        </div>
      </main>

      {/* Modals */}
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
        profile={userRegistry.profile}
        onCreateProfile={userRegistry.createProfile}
        onUpdateProfile={userRegistry.updateProfile}
        appWalletAddress={appWallet.appWalletAddress}
        appWalletBalance={appWallet.balance}
        isAuthorized={appWallet.isAuthorized}
        onSetupAppWallet={handleSetupAppWallet}
        onTopUp={appWallet.fundWallet}
      />

      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
        onCreate={handleCreateChannel}
      />
    </div>
  );
}

export default App;
