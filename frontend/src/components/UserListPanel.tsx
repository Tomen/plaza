import { useMemo } from 'react';
import type { FormattedMessage } from '../types/contracts';
import { truncateAddress } from '../utils/formatters';

interface ChannelUser {
  address: string;
  displayName?: string;
  lastPostTime: number;
  messageCount: number;
}

interface UserListPanelProps {
  messages: FormattedMessage[];
  currentAddress: string | null;
}

export function UserListPanel({ messages, currentAddress }: UserListPanelProps) {
  const users = useMemo(() => {
    const userMap = new Map<string, ChannelUser>();

    for (const msg of messages) {
      const addr = msg.profileOwner.toLowerCase();
      const existing = userMap.get(addr);

      if (!existing) {
        userMap.set(addr, {
          address: msg.profileOwner,
          displayName: msg.displayName,
          lastPostTime: msg.timestamp,
          messageCount: 1,
        });
      } else {
        existing.messageCount++;
        if (msg.timestamp > existing.lastPostTime) {
          existing.lastPostTime = msg.timestamp;
          if (msg.displayName) {
            existing.displayName = msg.displayName;
          }
        }
      }
    }

    return Array.from(userMap.values()).sort(
      (a, b) => b.lastPostTime - a.lastPostTime
    );
  }, [messages]);

  const currentAddrLower = currentAddress?.toLowerCase();

  return (
    <div className="w-56 border-l-2 border-primary-500 bg-black flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-primary-700">
        <h2 className="text-primary-500 font-mono text-sm font-bold">
          USERS <span className="text-primary-700">({users.length})</span>
        </h2>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {users.length === 0 ? (
          <div className="p-4 text-primary-700 font-mono text-sm">
            No messages yet
          </div>
        ) : (
          <div className="py-2">
            {users.map((user) => {
              const isCurrentUser =
                user.address.toLowerCase() === currentAddrLower;
              const displayIdentifier =
                user.displayName || truncateAddress(user.address);

              return (
                <div
                  key={user.address}
                  className="px-4 py-1.5 font-mono text-sm flex items-center gap-2"
                >
                  <span
                    className={
                      isCurrentUser ? 'text-accent-400' : 'text-primary-600'
                    }
                  >
                    ●
                  </span>
                  <span
                    className={
                      isCurrentUser ? 'text-accent-400' : 'text-primary-400'
                    }
                    title={user.address}
                  >
                    {isCurrentUser ? 'YOU' : displayIdentifier}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
