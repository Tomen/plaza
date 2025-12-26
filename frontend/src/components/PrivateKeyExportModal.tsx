import { useState } from 'react';
import toast from 'react-hot-toast';

interface PrivateKeyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  privateKey: string;
}

export function PrivateKeyExportModal({
  isOpen,
  onClose,
  privateKey,
}: PrivateKeyExportModalProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(privateKey);
      toast.success('Private key copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleClose = () => {
    setIsRevealed(false);
    setConfirmed(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-80"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 border-2 border-red-500 bg-black p-6">
        <h2 className="text-xl font-bold text-red-500 text-shadow-neon mb-2 font-mono text-center">
          ▄▄▄ EXPORT PRIVATE KEY ▄▄▄
        </h2>

        {/* Warnings */}
        <div className="mb-4 p-4 border-2 border-red-700 bg-red-950 bg-opacity-30">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-xl">⚠</span>
            <div className="font-mono text-sm text-red-400">
              <p className="font-bold mb-2">DANGER: PROTECT YOUR PRIVATE KEY</p>
              <ul className="text-xs text-red-500 space-y-1">
                <li>• Anyone with this key can steal ALL your funds</li>
                <li>• NEVER share this key with anyone</li>
                <li>• NEVER paste it into websites or apps you don't trust</li>
                <li>• Store it securely offline (paper, password manager)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 accent-red-500"
          />
          <span className="font-mono text-sm text-primary-400">
            I understand the risks and want to reveal my private key
          </span>
        </label>

        {/* Private Key Display */}
        <div className="mb-4">
          <label className="block text-primary-400 font-mono text-xs mb-2">
            PRIVATE KEY
          </label>
          <div className="relative">
            <div
              className={`px-3 py-3 bg-black border-2 border-primary-500 font-mono text-sm break-all ${
                isRevealed ? 'text-yellow-400' : 'text-gray-600'
              }`}
            >
              {isRevealed ? privateKey : '●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●'}
            </div>
            {!confirmed && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <span className="text-gray-500 font-mono text-xs">Confirm above to reveal</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isRevealed ? (
            <>
              <button
                onClick={handleClose}
                className="flex-1 py-2 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500"
              >
                CANCEL
              </button>
              <button
                onClick={() => setIsRevealed(true)}
                disabled={!confirmed}
                className={`flex-1 py-2 font-mono text-sm border-2 ${
                  confirmed
                    ? 'bg-red-900 hover:bg-red-800 text-red-400 border-red-500'
                    : 'bg-gray-900 text-gray-600 border-gray-700 cursor-not-allowed'
                }`}
              >
                REVEAL KEY
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="flex-1 py-2 bg-yellow-900 hover:bg-yellow-800 text-yellow-400 border-2 border-yellow-500 font-mono text-sm"
              >
                COPY TO CLIPBOARD
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500"
              >
                DONE
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
