import { useState, useRef, useEffect } from 'react';
import { truncateAddress } from '../utils/formatters';
import { AddressDisplay } from './UserAddress';
import type { DecryptedMessage } from '../hooks/useDMConversation';

interface DMConversationViewProps {
  messages: DecryptedMessage[];
  isLoading: boolean;
  isSending: boolean;
  onSendMessage: (content: string) => Promise<void>;
  otherParticipantName: string | null;
  otherParticipantAddress: string;
  canSend: boolean;
  noSessionKey: boolean;
  isParticipant: boolean;
  participantNames?: { name1: string; name2: string } | null;
}

export function DMConversationView({
  messages,
  isLoading,
  isSending,
  onSendMessage,
  otherParticipantName,
  otherParticipantAddress,
  canSend,
  noSessionKey,
  isParticipant,
  participantNames,
}: DMConversationViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !canSend || isSending) return;

    try {
      await onSendMessage(inputValue.trim());
      // Only clear on success
      setInputValue('');
    } catch (err) {
      console.error('Failed to send message:', err);
      // Text stays in input on failure
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: DecryptedMessage[] }[] = [];
  let currentDate = '';

  messages.forEach((msg) => {
    const msgDate = formatDate(msg.timestamp);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  // Non-participant view - show encrypted conversation notice
  if (!isParticipant) {
    return (
      <div className="h-full flex flex-col bg-black">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-primary-500 text-4xl mb-6">🔒</div>
            <h2 className="text-xl font-bold text-primary-500 text-shadow-neon font-mono mb-4">
              ENCRYPTED CONVERSATION
            </h2>
            <p className="text-primary-400 font-mono text-sm mb-6">
              This is an encrypted conversation between{' '}
              <span className="text-accent-400 font-semibold">
                {participantNames?.name1 || '...'}
              </span>
              {' '}and{' '}
              <span className="text-accent-400 font-semibold">
                {participantNames?.name2 || '...'}
              </span>
            </p>
            <p className="text-primary-600 font-mono text-xs">
              Only the participants can view the messages in this conversation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b-2 border-primary-500 p-4">
        <div className="flex items-center">
          <div>
            <h2 className="text-lg font-bold text-primary-500 text-shadow-neon font-mono">
              {otherParticipantName || truncateAddress(otherParticipantAddress)}
            </h2>
            {otherParticipantName && (
              <div className="mt-0.5">
                <AddressDisplay address={otherParticipantAddress} size="xs" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session key warning */}
      {noSessionKey && (
        <div className="border-b border-yellow-500 bg-yellow-950 bg-opacity-20 p-3">
          <div className="flex items-center font-mono text-sm">
            <span className="text-yellow-500 mr-2">!</span>
            <span className="text-yellow-400">
              Recipient has no session key. They won't be able to read your messages until they set one up.
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-primary-600 font-mono text-sm animate-pulse">
              Loading messages...
            </span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-primary-600 font-mono text-sm">
                No messages yet
              </p>
              <p className="text-primary-700 font-mono text-xs mt-2">
                Send a message to start the conversation
              </p>
            </div>
          </div>
        ) : (
          <>
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="border-t border-primary-800 flex-1" />
                  <span className="px-4 text-primary-600 font-mono text-xs">
                    {group.date}
                  </span>
                  <div className="border-t border-primary-800 flex-1" />
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {group.messages.map((msg) => (
                    <div
                      key={msg.index}
                      className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] ${
                          msg.isFromMe
                            ? 'bg-primary-950 border border-primary-700'
                            : 'bg-accent-950 border border-accent-800'
                        } ${msg.decryptionFailed ? 'opacity-50' : ''}`}
                      >
                        <div className="p-3">
                          <p
                            className={`font-mono text-sm whitespace-pre-wrap break-words ${
                              msg.isFromMe ? 'text-primary-300' : 'text-accent-300'
                            } ${msg.decryptionFailed ? 'italic' : ''}`}
                          >
                            {msg.content}
                          </p>
                          <p
                            className={`font-mono text-xs mt-2 ${
                              msg.isFromMe ? 'text-primary-700 text-right' : 'text-accent-700'
                            }`}
                          >
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t-2 border-primary-500 bg-black p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 font-mono text-sm">
              &gt;
            </span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={canSend ? '[ENTER MESSAGE]' : '[CANNOT SEND]'}
              disabled={!canSend || isSending}
              className="w-full pl-8 pr-4 py-3 bg-black border-2 border-primary-500 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 disabled:border-gray-700 disabled:text-gray-600 disabled:shadow-none placeholder-primary-800 transition-all shadow-neon-input"
              maxLength={1000}
            />
          </div>
          <button
            type="submit"
            disabled={!canSend || isSending || !inputValue.trim()}
            className="bg-primary-900 hover:bg-primary-800 disabled:bg-gray-900 text-primary-400 disabled:text-gray-700 font-mono text-sm px-8 py-3 border-2 border-primary-500 hover:border-primary-400 disabled:border-gray-700 disabled:shadow-none transition-all uppercase tracking-wider font-bold shadow-neon-button"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <span className="terminal-cursor">█</span>
                SENDING
              </span>
            ) : (
              '▶ SEND'
            )}
          </button>
        </div>
        <div className="mt-2 flex justify-between items-center font-mono text-xs">
          <span className="text-primary-700">
            [ENCRYPTED MESSAGE]
          </span>
          <span className={`${inputValue.length > 900 ? 'text-red-500' : 'text-primary-600'}`}>
            {inputValue.length}/1000 CHARS
          </span>
        </div>
      </form>
    </div>
  );
}
