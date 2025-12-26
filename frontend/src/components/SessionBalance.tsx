import { formatBalance, truncateAddress } from '../utils/formatters';

interface SessionBalanceProps {
  address: string | null;
  balance: bigint;
  isAuthorized: boolean;
  onTopUp: () => void;
}

const LOW_BALANCE_THRESHOLD = 10n ** 15n; // 0.001 PAS

export function SessionBalance({ address, balance, isAuthorized, onTopUp }: SessionBalanceProps) {
  if (!address) return null;

  const isLow = balance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <div className="flex items-center gap-2">
        <span className="text-primary-600">[SESSION]</span>
        <span className="text-primary-400">{truncateAddress(address)}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={isLow ? 'text-red-500' : 'text-accent-400'}>
          {formatBalance(balance)} PAS
        </span>

        {isLow && (
          <button
            onClick={onTopUp}
            className="px-2 py-0.5 bg-red-900 hover:bg-red-800 text-red-400 border-2 border-red-500 hover:border-red-400 text-xs transition-all"
          >
            LOW - TOP UP
          </button>
        )}

        {!isAuthorized && (
          <span className="text-yellow-500">[NOT AUTHORIZED]</span>
        )}
      </div>
    </div>
  );
}
