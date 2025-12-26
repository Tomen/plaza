import { useState } from 'react';
import toast from 'react-hot-toast';
import { PostingMode } from '../types/contracts';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, postingMode: PostingMode) => Promise<void>;
}

export function CreateChannelModal({ isOpen, onClose, onCreate }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [postingMode, setPostingMode] = useState<PostingMode>(PostingMode.Open);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Channel name is required');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Creating channel...');

    try {
      await onCreate(name.trim(), description.trim(), postingMode);
      toast.success('Channel created!', { id: toastId });
      setName('');
      setDescription('');
      setPostingMode(PostingMode.Open);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create channel', { id: toastId });
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
          ▄▄▄ CREATE CHANNEL ▄▄▄
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-primary-400 font-mono text-sm mb-1">
              CHANNEL NAME *
            </label>
            <div className="flex">
              <span className="px-3 py-2 bg-primary-950 border-2 border-r-0 border-primary-500 text-accent-400 font-mono">
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 disabled:border-gray-700 disabled:text-gray-600"
                placeholder="general"
              />
            </div>
          </div>

          <div>
            <label className="block text-primary-400 font-mono text-sm mb-1">
              DESCRIPTION
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={isSubmitting}
              className="w-full px-3 py-2 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 disabled:border-gray-700 disabled:text-gray-600 resize-none"
              placeholder="What's this channel about?"
            />
          </div>

          <div>
            <label className="block text-primary-400 font-mono text-sm mb-2">
              POSTING MODE
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="postingMode"
                  checked={postingMode === PostingMode.Open}
                  onChange={() => setPostingMode(PostingMode.Open)}
                  disabled={isSubmitting}
                  className="accent-primary-500"
                />
                <span className="text-primary-400 font-mono text-sm">OPEN</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="postingMode"
                  checked={postingMode === PostingMode.Permissioned}
                  onChange={() => setPostingMode(PostingMode.Permissioned)}
                  disabled={isSubmitting}
                  className="accent-primary-500"
                />
                <span className="text-primary-400 font-mono text-sm">PRIVATE</span>
              </label>
            </div>
            <p className="text-xs text-primary-600 font-mono mt-1">
              {postingMode === PostingMode.Open
                ? 'Anyone with a profile can post'
                : 'Only approved users can post'}
            </p>
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
              disabled={isSubmitting || !name.trim()}
              className="flex-1 py-2 bg-primary-900 hover:bg-primary-800 text-primary-400 border-2 border-primary-500 font-mono text-sm disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-700"
            >
              {isSubmitting ? 'CREATING...' : 'CREATE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
