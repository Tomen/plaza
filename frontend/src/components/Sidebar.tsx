import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import type { RegisteredChannel } from '../types/contracts';
import ChatChannelABI from '../contracts/ChatChannel.json';

interface ChannelListItem {
  address: string;
  name: string;
}

interface SidebarProps {
  channels: RegisteredChannel[];
  selectedChannel: string | null;
  onSelectChannel: (address: string) => void;
  onCreateChannel: () => void;
  provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null;
  isConnected: boolean;
}

export function Sidebar({
  channels,
  selectedChannel,
  onSelectChannel,
  onCreateChannel,
  provider,
  isConnected,
}: SidebarProps) {
  const [channelNames, setChannelNames] = useState<ChannelListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!provider || channels.length === 0) {
      setChannelNames([]);
      return;
    }

    const loadChannelNames = async () => {
      setIsLoading(true);
      try {
        const names = await Promise.all(
          channels.map(async (ch) => {
            try {
              const contract = new ethers.Contract(
                ch.channelAddress,
                ChatChannelABI.abi,
                provider
              );
              const name = await contract.name();
              return { address: ch.channelAddress, name };
            } catch {
              return { address: ch.channelAddress, name: 'Unknown' };
            }
          })
        );
        setChannelNames(names);
      } finally {
        setIsLoading(false);
      }
    };

    loadChannelNames();
  }, [channels, provider]);

  return (
    <div className="w-64 border-r-2 border-primary-500 bg-black flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-primary-700">
        <h2 className="text-primary-500 font-mono text-sm font-bold">CHANNELS</h2>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-primary-600 font-mono text-sm">
            Loading channels...
          </div>
        ) : channelNames.length === 0 ? (
          <div className="p-4 text-primary-700 font-mono text-sm">
            No channels found
          </div>
        ) : (
          <div className="py-2">
            {channelNames.map((ch) => (
              <button
                key={ch.address}
                onClick={() => onSelectChannel(ch.address)}
                className={`w-full text-left px-4 py-2 font-mono text-sm transition-colors ${
                  selectedChannel === ch.address
                    ? 'bg-primary-900 text-primary-300 border-l-2 border-primary-400'
                    : 'text-primary-500 hover:bg-primary-950 hover:text-primary-400'
                }`}
              >
                <span className="text-accent-500">#</span> {ch.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create channel button */}
      {isConnected && (
        <div className="p-4 border-t border-primary-700">
          <button
            onClick={onCreateChannel}
            className="w-full py-2 bg-primary-900 hover:bg-primary-800 text-primary-400 border border-primary-500 font-mono text-sm"
          >
            + NEW CHANNEL
          </button>
        </div>
      )}
    </div>
  );
}
