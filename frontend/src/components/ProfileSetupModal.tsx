import { useState } from 'react';
import toast from 'react-hot-toast';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (displayName: string, bio: string) => Promise<void>;
  initialDisplayName?: string;
  initialBio?: string;
  isEdit?: boolean;
}

export function ProfileSetupModal({
  isOpen,
  onClose,
  onSubmit,
  initialDisplayName = '',
  initialBio = '',
  isEdit = false,
}: ProfileSetupModalProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(isEdit ? 'Updating profile...' : 'Creating profile...');

    try {
      await onSubmit(displayName.trim(), bio.trim());
      toast.success(isEdit ? 'Profile updated!' : 'Profile created!', { id: toastId });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 border-2 border-primary-500 bg-black p-6">
        <h2 className="text-xl font-bold text-primary-500 text-shadow-neon mb-4 font-mono">
          {isEdit ? '▄▄▄ EDIT PROFILE ▄▄▄' : '▄▄▄ CREATE PROFILE ▄▄▄'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-primary-400 font-mono text-sm mb-1">
              DISPLAY NAME *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 disabled:border-gray-700 disabled:text-gray-600"
              placeholder="Enter your display name"
            />
            <span className="text-xs text-primary-600 font-mono">
              {displayName.length}/50 chars
            </span>
          </div>

          <div>
            <label className="block text-primary-400 font-mono text-sm mb-1">
              BIO
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 disabled:border-gray-700 disabled:text-gray-600 resize-none"
              placeholder="Tell us about yourself (optional)"
            />
            <span className="text-xs text-primary-600 font-mono">
              {bio.length}/500 chars
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2 border-2 border-gray-600 text-gray-400 font-mono text-sm hover:border-gray-500 disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !displayName.trim()}
              className="flex-1 py-2 bg-primary-900 hover:bg-primary-800 text-primary-400 border-2 border-primary-500 font-mono text-sm disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
            >
              {isSubmitting ? 'SAVING...' : isEdit ? 'UPDATE' : 'CREATE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
