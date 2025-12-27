interface WalletChoiceModalProps {
  isOpen: boolean;
  onSelectBrowser: () => void;
  onSelectInApp: () => void;
  hasMetaMask: boolean;
  onClose?: () => void;
}

export function WalletChoiceModal({
  isOpen,
  onSelectBrowser,
  onSelectInApp,
  hasMetaMask,
  onClose,
}: WalletChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - click to close */}
      <div
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 border-2 border-primary-500 bg-black p-6">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-primary-600 hover:text-primary-400 text-xl font-mono transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        )}

        <h2 className="text-xl font-bold text-primary-500 text-shadow-neon mb-2 font-mono text-center">
          ▄▄▄ CONNECT WALLET ▄▄▄
        </h2>
        <p className="text-primary-600 font-mono text-sm text-center mb-4">
          Choose how you want to connect
        </p>

        {/* Warning Banner */}
        <div className="mb-6 p-3 border border-red-700 bg-red-950 bg-opacity-30">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg">⚠</span>
            <div className="font-mono text-xs text-red-400">
              <p className="font-bold text-red-300 mb-1">TECH DEMO - USE AT YOUR OWN RISK</p>
              <ul className="space-y-1 text-red-500">
                <li>• Messages are stored permanently on the blockchain</li>
                <li>• If your session key is compromised, your private messages may be exposed</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Browser Wallet Option */}
          <button
            onClick={onSelectBrowser}
            disabled={!hasMetaMask}
            className={`w-full p-4 border-2 text-left transition-all ${
              hasMetaMask
                ? 'bg-accent-950 bg-opacity-20 border-accent-500 hover:bg-accent-950 hover:bg-opacity-40 cursor-pointer'
                : 'bg-gray-900 border-gray-700 cursor-not-allowed opacity-70'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">🦊</div>
              <div className="flex-1">
                <h3 className={`font-mono font-bold ${hasMetaMask ? 'text-accent-400' : 'text-gray-500'}`}>
                  BROWSER WALLET
                </h3>
                <p className={`font-mono text-xs mt-1 ${hasMetaMask ? 'text-accent-600' : 'text-gray-600'}`}>
                  {hasMetaMask
                    ? 'Connect MetaMask or other browser wallet'
                    : 'MetaMask not detected'}
                </p>
              </div>
              {hasMetaMask && (
                <div className="text-accent-500 font-mono text-sm">
                  &gt;
                </div>
              )}
            </div>
          </button>

          {/* Session Account Option */}
          <button
            onClick={onSelectInApp}
            className="w-full p-4 bg-primary-950 bg-opacity-20 border-2 border-primary-500 hover:bg-primary-950 hover:bg-opacity-40 text-left transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">🔐</div>
              <div className="flex-1">
                <h3 className="font-mono font-bold text-primary-400">
                  SESSION ACCOUNT
                </h3>
                <p className="font-mono text-xs text-primary-600 mt-1">
                  We'll create a wallet for you in the browser
                </p>
              </div>
              <div className="text-primary-500 font-mono text-sm">
                &gt;
              </div>
            </div>
          </button>
        </div>

        {/* Info section */}
        <div className="mt-6 p-3 border border-yellow-700 bg-yellow-950 bg-opacity-20">
          <div className="flex items-start gap-2">
            <span className="text-yellow-500">!</span>
            <div className="font-mono text-xs text-yellow-600">
              <p><strong className="text-yellow-500">SESSION ACCOUNT:</strong> Quick setup, but you'll need to fund it via faucet to post messages.</p>
              <p className="mt-1"><strong className="text-yellow-500">BROWSER WALLET:</strong> More secure, uses your existing wallet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
