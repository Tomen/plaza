import { useState } from 'react';
import { ethers } from 'ethers';

interface NewDMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateConversation: (otherUser: string) => Promise<string>;
  checkConversationExists: (user1: string, user2: string) => Promise<boolean>;
  getExistingConversation: (user1: string, user2: string) => Promise<string>;
  userAddress: string | null;
}

export function NewDMModal({
  isOpen,
  onClose,
  onCreateConversation,
  checkConversationExists,
  getExistingConversation,
  userAddress,
}: NewDMModalProps) {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !userAddress) return;

    setError(null);
    setIsLoading(true);

    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error('Invalid Ethereum address');
      }

      // Check if user is trying to DM themselves
      if (address.toLowerCase() === userAddress.toLowerCase()) {
        throw new Error('Cannot start a conversation with yourself');
      }

      // Check if conversation already exists
      const exists = await checkConversationExists(userAddress, address);
      if (exists) {
        // Get existing conversation and switch to it
        const existingAddr = await getExistingConversation(userAddress, address);
        setAddress('');
        onClose();
        // Return existing conversation address - parent should switch to it
        return existingAddr;
      }

      // Create new conversation
      await onCreateConversation(address);
      setAddress('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

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
            NEW CONVERSATION
          </h2>
          <button
            onClick={onClose}
            className="text-primary-500 hover:text-primary-400 text-2xl font-mono"
          >
            x
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-primary-600 font-mono text-xs mb-2">
              RECIPIENT ADDRESS
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-black border-2 border-primary-700 px-4 py-3 text-primary-300 font-mono text-sm placeholder-primary-700 focus:outline-none focus:border-primary-500 focus:shadow-neon-input"
              disabled={isLoading}
            />
            <p className="mt-2 text-primary-700 font-mono text-xs">
              Enter the wallet address of the user you want to message
            </p>
          </div>

          {error && (
            <div className="p-3 border border-red-500 bg-red-950 bg-opacity-20">
              <p className="text-red-400 font-mono text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 transition-colors disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isLoading || !address.trim()}
              className="flex-1 py-3 border-2 border-primary-500 bg-primary-950 text-primary-500 font-mono text-sm hover:bg-primary-900 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'CREATING...' : 'START CHAT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
