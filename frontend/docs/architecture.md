# Application Architecture

## Overview

On-Chain Chat is a decentralized messaging application built on Paseo Asset Hub (Polkadot testnet). It supports two wallet modes and uses React hooks for state management.

## Core Concepts

### Wallet Modes

The application supports three wallet modes:

| Mode | Description | Provider Type | Signer Source |
|------|-------------|---------------|---------------|
| `browser` | MetaMask or similar | `BrowserProvider` | `provider.getSigner()` |
| `standalone` | Session account (no extension) | `JsonRpcProvider` | `ethers.Wallet` from localStorage |
| `none` | Not connected | N/A | N/A |

**Key Difference**: `BrowserProvider` can provide a signer via `getSigner()`, but `JsonRpcProvider` is read-only and requires an external signer.

### Smart Contracts

```
ChannelRegistry (address from URL ?registry=0x...)
    ├── userRegistry() → UserRegistry address
    ├── channels[] → ChatChannel addresses
    └── createChannel() → new ChatChannel

UserRegistry
    ├── profiles[address] → Profile data
    ├── delegates[owner][delegate] → bool
    └── createProfile(), addDelegate(), etc.

ChatChannel
    ├── messages[] → Message data
    └── postMessage(content)
```

## State Flow

### Initialization Sequence

```
1. App mounts
   ├── Check localStorage for existing standalone wallet
   │   └── If exists → walletMode = 'standalone'
   │   └── If not → walletMode = 'none' → show WalletChoiceModal
   │
2. Based on walletMode:
   ├── 'standalone':
   │   ├── Create JsonRpcProvider (read-only)
   │   ├── Initialize appWallet from localStorage
   │   └── Connect wallet to provider
   │
   └── 'browser':
       ├── User clicks "Connect Browser Wallet"
       ├── browserWallet.connect() → requests MetaMask
       └── BrowserProvider created from window.ethereum

3. walletConfig computed (useMemo)
   ├── activeProvider: JsonRpcProvider | BrowserProvider
   ├── activeAddress: wallet address
   ├── activeSigner: Wallet instance (standalone) | null (browser)
   ├── channelSigner: for posting messages
   └── isReady: boolean

4. Hooks receive walletConfig values
   ├── useChannelRegistry → loads channels
   ├── useUserRegistry → loads profile
   └── useChannel → loads messages
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           App.tsx                                │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  useWallet   │    │ useAppWallet │    │JsonRpcProvider│       │
│  │  (browser)   │    │              │    │ (standalone) │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └─────────┬─────────┴───────────────────┘                │
│                   │                                              │
│                   ▼                                              │
│         ┌─────────────────┐                                      │
│         │  walletConfig   │  (useMemo - single source of truth)  │
│         │  - activeProvider                                      │
│         │  - activeAddress                                       │
│         │  - activeSigner                                        │
│         │  - channelSigner                                       │
│         │  - isReady                                             │
│         └────────┬────────┘                                      │
│                  │                                               │
│    ┌─────────────┼─────────────┬─────────────┐                  │
│    ▼             ▼             ▼             ▼                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │useChannel│ │useChannel│ │useUser   │ │Components│            │
│ │Registry  │ │          │ │Registry  │ │          │            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Hook Architecture

### Shared Utilities (`src/utils/contracts.ts`)

All hooks use shared contract creation utilities:

```typescript
// Read-only contract (works with any provider)
createReadContract(address, abi, provider) → Contract | null

// Write contract (handles provider type differences)
createWriteContract(address, abi, provider, externalSigner) → Contract | null
```

**Important**: `createWriteContract` checks if provider is `BrowserProvider` before calling `getSigner()`. For `JsonRpcProvider`, it requires an `externalSigner`.

### Hook Pattern

Each data hook follows this pattern:

```typescript
interface UseXxxProps {
  address: string | null;      // Contract address
  provider: Provider | null;   // Read operations
  signer?: Signer | null;      // Write operations (standalone mode)
  enabled?: boolean;           // Skip operations if false
}

function useXxx({ address, provider, signer, enabled = true }) {
  // State
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Contract getters (memoized)
  const getReadContract = useCallback(() => {
    return createReadContract(address, ABI, provider);
  }, [address, provider]);

  const getWriteContract = useCallback(async () => {
    return createWriteContract(address, ABI, provider, signer);
  }, [address, provider, signer]);

  // Load data on mount/change
  useEffect(() => {
    if (enabled && address && provider) {
      loadData();
    }
  }, [enabled, address, provider]);

  // Write operations check enabled
  const writeOperation = useCallback(async () => {
    if (!enabled) throw new Error("Wallet not ready");
    const contract = await getWriteContract();
    // ... perform write
  }, [enabled, getWriteContract]);

  return { data, isLoading, error, writeOperation };
}
```

### Wallet State Machine (`useAppWallet`)

```
        ┌─────────┐
        │  idle   │  (initial state, no wallet)
        └────┬────┘
             │ initializeWallet() or initializeStandaloneWallet()
             ▼
      ┌──────────────┐
      │ initializing │  (loading from storage, creating wallet)
      └──────┬───────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
  ┌───────┐    ┌───────┐
  │ ready │    │ error │
  └───────┘    └───────┘
```

**Key Properties**:
- `walletState`: Current state in the machine
- `isReady`: Convenience boolean (`walletState === 'ready'`)
- `appWallet`: The `ethers.Wallet` instance (null until ready)

## Common Pitfalls

### 1. Infinite Loops in useEffect

**Problem**: Hook return objects are recreated every render.

```typescript
// BAD - causes infinite loop
useEffect(() => {
  channelRegistry.loadChannels();
}, [channelRegistry]); // channelRegistry is new object each render!

// GOOD - depend only on stable values
useEffect(() => {
  if (registryAddress && provider) {
    channelRegistry.loadChannels();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [registryAddress, provider]);
```

### 2. Calling getSigner() on JsonRpcProvider

**Problem**: `JsonRpcProvider` is read-only, has no signer.

```typescript
// BAD - fails in standalone mode
const signer = await provider.getSigner();

// GOOD - use shared utility that handles both cases
const contract = await createWriteContract(address, abi, provider, externalSigner);
```

### 3. Race Conditions During Initialization

**Problem**: Using wallet before it's ready.

```typescript
// BAD - wallet might be null
const contract = new ethers.Contract(addr, abi, appWallet.appWallet);

// GOOD - check isReady first
if (!walletConfig.isReady) return;
const contract = await getWriteContract();
```

### 4. Wrong Provider/Address for Mode

**Problem**: Using browser wallet values in standalone mode.

```typescript
// BAD - scattered conditionals
const address = walletMode === 'standalone' ? appWallet.address : browserWallet.address;

// GOOD - use centralized walletConfig
const address = walletConfig.activeAddress;
```

## File Structure

```
src/
├── hooks/
│   ├── useWallet.ts          # Browser wallet connection (MetaMask)
│   ├── useAppWallet.ts       # App wallet with state machine
│   ├── useUserRegistry.ts    # Profile management
│   ├── useChannelRegistry.ts # Channel listing/creation
│   └── useChannel.ts         # Message loading/posting
│
├── utils/
│   ├── contracts.ts          # Shared contract utilities
│   ├── appWallet.ts          # localStorage wallet management
│   └── formatters.ts         # Display formatting
│
├── components/
│   ├── AccountModal.tsx      # Profile/wallet management UI
│   ├── WalletChoiceModal.tsx # Initial wallet selection
│   ├── SessionAccountSetup.tsx  # Standalone wallet funding
│   └── ...                   # Other UI components
│
└── App.tsx                   # Main component, walletConfig
```

## Testing Checklist

### Browser Wallet Flow
1. [ ] Connect MetaMask
2. [ ] Create profile
3. [ ] Send message
4. [ ] Setup session account (optional)
5. [ ] Send message via session account
6. [ ] Disconnect

### Standalone Wallet Flow
1. [ ] Create new session account
2. [ ] Fund wallet
3. [ ] Create profile
4. [ ] Send message
5. [ ] Export private key
6. [ ] Connect browser wallet
7. [ ] Transfer ownership OR add as delegate
8. [ ] Disconnect

### Mode Switching
1. [ ] Start standalone → connect browser → transfer ownership → mode becomes browser
2. [ ] Start browser → disconnect → start standalone → works correctly
3. [ ] Refresh page → correct mode restored from localStorage

## Adding New Features

### Adding a New Contract Hook

1. Create hook file following the pattern in "Hook Pattern" section
2. Use `createReadContract` and `createWriteContract` from utils
3. Add `enabled` prop to prevent operations when wallet not ready
4. In App.tsx, pass `walletConfig` values to the hook
5. Add `enabled: walletConfig.isReady` prop

### Adding a New Write Operation

1. Check `enabled` at the start of the function
2. Use `getWriteContract()` (not direct contract creation)
3. Handle errors appropriately
4. Refresh relevant data after successful write

## Debugging Tips

### Check Wallet State
```javascript
console.log({
  mode: walletMode,
  isReady: walletConfig.isReady,
  activeAddress: walletConfig.activeAddress,
  hasSigner: !!walletConfig.activeSigner,
});
```

### Check Provider Type
```javascript
console.log({
  providerType: provider?.constructor.name,
  canGetSigner: 'getSigner' in provider,
});
```

### Common Error Messages

| Error | Likely Cause |
|-------|--------------|
| "Contract not available" | Provider or address is null, or getSigner() failed |
| "no such account" | Signer not connected to provider |
| "Wallet not ready" | Operation attempted before `enabled` is true |
| "Maximum update depth" | Hook object in useEffect dependency array |
