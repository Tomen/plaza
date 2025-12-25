import { useEffect, useRef, useState } from 'react';
import type { FormattedMessage } from '../types/contracts';
import { truncateAddress, formatTimestamp } from '../utils/formatters';

interface ChatFeedProps {
  messages: FormattedMessage[];
  isLoading: boolean;
  currentAddress: string | null;
}

export function ChatFeed({ messages, isLoading, currentAddress }: ChatFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track if we've completed the initial load
  useEffect(() => {
    if (!isLoading) {
      setHasLoadedOnce(true);
    }
  }, [isLoading]);

  // Only show loading state if we haven't loaded at least once
  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black p-8">
        <div className="text-orange-500 font-mono text-center">
          <div className="text-2xl mb-4 terminal-cursor">...</div>
          <div className="text-sm text-shadow-neon-sm">LOADING MESSAGES...</div>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black p-8">
        <div className="text-center font-mono">
          <div className="text-orange-500 text-lg mb-2 text-shadow-neon">
            [EMPTY CHAT ROOM]
          </div>
          <div className="text-orange-700 text-sm">
            &gt; Be the first to post a message_
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 space-y-2">
      {messages.map((msg, index) => {
        const isCurrentUser = msg.profileOwner.toLowerCase() === currentAddress?.toLowerCase();
        const displayIdentifier = msg.displayName || truncateAddress(msg.profileOwner);
        const isDelegate = msg.sender.toLowerCase() !== msg.profileOwner.toLowerCase();

        return (
          <div key={index} className="flex justify-start">
            <div className="w-full max-w-4xl font-mono text-sm">
              {/* Single line message */}
              <div className="flex items-baseline gap-4 text-orange-400">
                {/* Timestamp */}
                <span className="text-orange-600 text-xs flex-shrink-0">
                  [ {formatTimestamp(msg.timestamp)} ]
                </span>

                {/* Username/Address */}
                <span className={`${isCurrentUser ? 'text-cyan-400 font-semibold' : 'text-orange-500'} flex-shrink-0`}>
                  {isCurrentUser ? 'YOU' : displayIdentifier}
                  {isDelegate && <span className="text-orange-700 text-xs ml-1">(via delegate)</span>}
                  {' :'}
                </span>

                {/* Message content */}
                <span className="text-orange-300 break-words flex-1">
                  {msg.content}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
