import { useState, useEffect } from 'react';
import { truncateAddress } from '../utils/formatters';
import type { ConversationInfo } from '../hooks/useDMRegistry';

interface DMListProps {
  conversations: ConversationInfo[];
  selectedConversation: string | null;
  onSelectConversation: (address: string) => void;
  onNewDM: () => void;
  isLoading: boolean;
  getDisplayName: (address: string) => Promise<string>;
}

interface ConversationWithName extends ConversationInfo {
  displayName: string;
}

export function DMList({
  conversations,
  selectedConversation,
  onSelectConversation,
  onNewDM,
  isLoading,
  getDisplayName,
}: DMListProps) {
  const [conversationsWithNames, setConversationsWithNames] = useState<ConversationWithName[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);

  // Load display names for conversations
  useEffect(() => {
    if (conversations.length === 0) {
      setConversationsWithNames([]);
      return;
    }

    setLoadingNames(true);
    Promise.all(
      conversations.map(async (conv) => {
        const displayName = await getDisplayName(conv.otherParticipant);
        return { ...conv, displayName };
      })
    )
      .then(setConversationsWithNames)
      .finally(() => setLoadingNames(false));
  }, [conversations, getDisplayName]);

  return (
    <div className="h-full flex flex-col bg-black border-r-2 border-primary-500">
      {/* Header */}
      <div className="border-b-2 border-primary-500 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary-500 text-shadow-neon font-mono">
            DIRECT MESSAGES
          </h2>
          <button
            onClick={onNewDM}
            className="px-3 py-1 text-sm font-mono text-primary-500 border border-primary-500 hover:bg-primary-950 transition-colors"
          >
            + NEW
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading || loadingNames ? (
          <div className="p-4 text-center">
            <span className="text-primary-600 font-mono text-sm animate-pulse">
              Loading...
            </span>
          </div>
        ) : conversationsWithNames.length === 0 ? (
          <div className="p-4 text-center">
            <span className="text-primary-700 font-mono text-sm">
              No conversations yet
            </span>
            <button
              onClick={onNewDM}
              className="block w-full mt-4 py-2 text-sm font-mono text-accent-400 border border-accent-500 hover:bg-accent-950 transition-colors"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-primary-900">
            {conversationsWithNames.map((conv) => (
              <button
                key={conv.address}
                onClick={() => onSelectConversation(conv.address)}
                className={`w-full p-4 text-left transition-colors ${
                  selectedConversation === conv.address
                    ? 'bg-primary-950 border-l-4 border-primary-500'
                    : 'hover:bg-primary-950 hover:bg-opacity-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-primary-400 font-mono text-sm truncate">
                      {conv.displayName || truncateAddress(conv.otherParticipant)}
                    </p>
                    {conv.displayName && (
                      <p className="text-primary-700 font-mono text-xs mt-1 truncate">
                        {truncateAddress(conv.otherParticipant)}
                      </p>
                    )}
                  </div>
                  {conv.messageCount > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-primary-900 text-primary-500 font-mono text-xs rounded">
                      {conv.messageCount}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
