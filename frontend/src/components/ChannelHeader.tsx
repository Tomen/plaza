import type { ChannelInfo } from '../types/contracts';
import { PostingMode } from '../types/contracts';

interface ChannelHeaderProps {
  channelInfo: ChannelInfo | null;
  isLoading: boolean;
}

export function ChannelHeader({ channelInfo, isLoading }: ChannelHeaderProps) {
  if (isLoading) {
    return (
      <div className="border-b-2 border-orange-500 bg-orange-950 bg-opacity-30 px-4 py-3">
        <div className="font-mono text-orange-600 text-sm">Loading channel...</div>
      </div>
    );
  }

  if (!channelInfo) {
    return null;
  }

  return (
    <div className="border-b-2 border-orange-500 bg-orange-950 bg-opacity-30 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-orange-500 font-mono flex items-center gap-2">
            <span className="text-cyan-400">#</span>
            {channelInfo.name}
            {channelInfo.postingMode === PostingMode.Permissioned && (
              <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-0.5 border border-yellow-600">
                PRIVATE
              </span>
            )}
          </h2>
          {channelInfo.description && (
            <p className="text-xs text-orange-600 font-mono mt-1">
              {channelInfo.description}
            </p>
          )}
        </div>
        <div className="text-right font-mono text-xs text-orange-600">
          <div>{channelInfo.messageCount.toString()} messages</div>
        </div>
      </div>

      {channelInfo.motd && (
        <div className="mt-2 px-3 py-2 bg-cyan-950 bg-opacity-50 border border-cyan-700">
          <span className="text-cyan-500 font-mono text-xs">MOTD:</span>
          <span className="text-cyan-400 font-mono text-xs ml-2">{channelInfo.motd}</span>
        </div>
      )}
    </div>
  );
}
