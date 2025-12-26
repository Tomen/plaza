import { useState, useRef, useEffect } from 'react';
import { truncateAddress } from '../utils/formatters';
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
}: DMConversationViewProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !canSend || isSending) return;

    const content = inputValue.trim();
    setInputValue('');

    try {
      await onSendMessage(content);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore input on failure
      setInputValue(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
              <p className="text-primary-700 font-mono text-xs">
                {truncateAddress(otherParticipantAddress)}
              </p>
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
      <form onSubmit={handleSubmit} className="border-t-2 border-primary-500 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={canSend ? 'Type a message...' : 'Cannot send messages'}
            disabled={!canSend || isSending}
            rows={1}
            className="flex-1 bg-black border-2 border-primary-700 px-4 py-2 text-primary-300 font-mono text-sm placeholder-primary-700 focus:outline-none focus:border-primary-500 focus:shadow-neon-input resize-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSend || isSending || !inputValue.trim()}
            className="px-6 py-2 bg-primary-950 border-2 border-primary-500 text-primary-500 font-mono text-sm hover:bg-primary-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? '...' : 'SEND'}
          </button>
        </div>
      </form>
    </div>
  );
}
