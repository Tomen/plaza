# User Flows

This document describes the wallet connection and user flows for the On-Chain Chat application.

> **See also:** [Architecture Documentation](./architecture.md) for technical details on hooks, state management, and common pitfalls.

## Overview

The app supports two wallet modes:
- **Browser Wallet**: Uses MetaMask or other injected wallet providers
- **In-App Wallet**: Creates a wallet stored in localStorage (no browser extension required)

---

## Flow 1: New User with In-App Wallet

For users who don't have MetaMask or prefer not to use it.

```
1. User opens app (first visit, no existing wallet)
2. WalletChoiceModal appears
3. User clicks "In-App Wallet"
4. InAppWalletSetup modal appears showing:
   - Generated wallet address (copyable)
   - Current balance (starts at 0)
   - Faucet instructions with link to https://faucet.polkadot.io/?parachain=1111
5. User copies address and requests PAS tokens from faucet
6. User clicks "Refresh" to update balance
7. Once balance > 0, "Continue" button becomes enabled
8. User clicks "Continue" → enters main chat UI in standalone mode
9. User types a message and sends
10. Profile is auto-created with address-derived name (e.g., "0x1a2b3c4d")
11. Message is posted to the channel
```

**Key files:**
- `WalletChoiceModal.tsx` - Initial wallet selection
- `InAppWalletSetup.tsx` - Faucet instructions and balance check
- `useAppWallet.ts` - Standalone wallet management
- `utils/appWallet.ts` - localStorage wallet storage

---

## Flow 2: New User with Browser Wallet

For users with MetaMask or similar browser extension.

```
1. User opens app (first visit)
2. WalletChoiceModal appears
3. User clicks "Browser Wallet"
4. MetaMask popup appears for connection approval
5. User approves connection
6. User enters main chat UI in browser mode
7. User types a message and sends
8. Profile is auto-created if none exists
9. Message is posted to the channel
```

**Optional gasless messaging setup:**
```
10. User opens Account Modal
11. User sees "Set up in-app wallet for gasless messaging" section
12. User clicks "Setup In-App Wallet"
13. App creates delegate wallet and registers it on-chain
14. User funds the delegate wallet
15. Future messages are sent via delegate (no MetaMask popups)
```

---

## Flow 3: Returning User with Existing In-App Wallet

For users who previously created an in-app wallet.

```
1. User opens app
2. App detects existing standalone wallet in localStorage
3. User automatically enters standalone mode
4. Balance is fetched from Paseo Asset Hub RPC
5. User can immediately start chatting
```

**Detection logic:**
- `hasStandaloneWallet()` checks localStorage for saved wallet
- If found, `walletMode` is set to `'standalone'` on app load

---

## Flow 4: In-App User Links Browser Wallet

For users who started with in-app wallet but want to use their browser wallet.

```
1. User is in standalone mode with in-app wallet + profile
2. User opens Account Modal
3. User clicks "Connect Browser Wallet"
4. MetaMask popup appears
5. User approves connection
6. LinkBrowserWalletModal appears with two options:

   Option A - Add as Delegate:
   - Browser wallet is added as delegate for in-app profile
   - User stays in standalone mode
   - Browser wallet can post on behalf of in-app profile

   Option B - Transfer Ownership (Recommended):
   - Profile ownership transfers to browser wallet
   - All profile data (name, bio, links) moves to browser wallet
   - In-app wallet profile is deleted
   - User switches to browser mode
   - Profile is refreshed to show under browser wallet
```

**Key files:**
- `LinkBrowserWalletModal.tsx` - Options for linking
- `useUserRegistry.ts` - `transferProfileOwnership()` and `addDelegate()`

---

## Flow 5: Disconnect and Reconnect

```
1. User is connected (either mode)
2. User opens Account Modal
3. User clicks "Disconnect"
4. App state resets:
   - browserWallet.disconnect() called
   - appWallet.disconnect() called
   - walletMode set to 'none'
5. AccountModal closes
6. WalletChoiceModal appears
7. User can choose browser or in-app wallet again
```

**Note:**
- Disconnecting preserves the in-app wallet in localStorage but persists the disconnected state
- Page refresh keeps user disconnected (wallet mode stored in localStorage)
- When user selects "In-App Wallet" again, they get the same wallet back with their funds intact
- To permanently delete a standalone wallet, use `appWallet.deleteStandaloneWallet()` (not yet exposed in UI)

---

## Flow 6: Auto Profile Creation

When a user posts a message without an existing profile.

```
1. User clicks send on a message
2. handleSendMessage checks if profile exists
3. If no profile:
   a. Toast shows "Creating profile..."
   b. createDefaultProfile() is called on UserRegistry contract
   c. Profile is created with display name = "0x" + first 8 hex chars of address
   d. Toast shows "Profile created!"
4. Message is posted
```

**Contract function:**
```solidity
function createDefaultProfile() external {
    require(!profiles[msg.sender].exists, "Profile already exists");
    string memory defaultName = _addressToShortString(msg.sender);
    profiles[msg.sender] = Profile({
        owner: msg.sender,
        displayName: defaultName,
        bio: "",
        exists: true
    });
    emit ProfileCreated(msg.sender);
}
```

---

## Flow 7: Export Private Key

For in-app wallet users who want to backup their wallet.

```
1. User is in standalone mode
2. User opens Account Modal
3. User clicks "Export Private Key"
4. PrivateKeyExportModal appears with:
   - Strong warning about keeping key secret
   - Private key hidden by default
   - "Show Private Key" button
   - Confirmation checkbox required
5. User checks confirmation box
6. User clicks "Show Private Key"
7. Private key is revealed
8. User can copy to clipboard
```

**Security notes:**
- Private key is stored in localStorage (not encrypted)
- Users should export and backup if they have significant funds
- Clearing browser data will delete the wallet
- Disconnecting does NOT delete the wallet - it remains in localStorage
- Use `deleteStandaloneWallet()` to permanently remove the wallet

---

## Wallet Mode States

| Mode | Active Address | Active Provider | Signer |
|------|---------------|-----------------|--------|
| `'none'` | null | null | null |
| `'browser'` | browserWallet.address | browserWallet.provider | provider.getSigner() |
| `'standalone'` | appWallet.appWalletAddress | standaloneProvider (JsonRpcProvider) | appWallet.appWallet |

---

## Network Configuration

- **Network:** Paseo Asset Hub Testnet
- **RPC URL:** `https://testnet-passet-hub-eth-rpc.polkadot.io`
- **Token:** PAS (testnet tokens)
- **Faucet:** https://faucet.polkadot.io/?parachain=1111

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `WalletChoiceModal` | Initial wallet type selection |
| `InAppWalletSetup` | Faucet instructions + funding check |
| `AccountModal` | Profile management, wallet info, disconnect |
| `AccountButton` | Header button showing connection status |
| `LinkBrowserWalletModal` | Options when browser wallet connects in standalone mode |
| `PrivateKeyExportModal` | Secure private key export with warnings |

---

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useWallet` | Browser wallet connection (MetaMask). Returns `isInitialized` to indicate initial connection check is complete. |
| `useAppWallet` | In-app wallet management (both modes) |
| `useUserRegistry` | Profile CRUD, delegate management |
| `useChannelRegistry` | Channel listing and creation |
| `useChannel` | Message posting and loading |

---

## Troubleshooting

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Balance shows 0 during setup | `provider` prop is null before mode changes | Use `appWallet.provider` (connected during init) |
| Balance shows 0 after connect | Wrong provider passed to hook | Ensure `walletConfig.activeProvider` is used |
| "Contract not available" | `getSigner()` called on JsonRpcProvider | Use `createWriteContract()` with external signer |
| "no such account" | Signer not connected to provider | Check `walletConfig.isReady` before operations |
| Profile disappears after transfer | Profile not refreshed | Add useEffect to refresh on mode change |
| Modal behind modal | Parent modal not closed | Close parent modal before opening child |
| Infinite re-renders | Hook object in useEffect deps | Only depend on primitive values, not whole hook return |
| WalletChoiceModal shows on reload | Effect fires before MetaMask auto-connects | Check `browserWallet.isInitialized` before showing modal |

### Debug Checklist

1. **Check wallet mode**: Is `walletMode` correct for the current state?
2. **Check isReady**: Is `walletConfig.isReady` true before attempting operations?
3. **Check isInitialized**: Is `browserWallet.isInitialized` true before showing connection modals?
4. **Check provider type**: Is the provider `BrowserProvider` or `JsonRpcProvider`?
5. **Check signer**: Is `walletConfig.activeSigner` passed to hooks in standalone mode?
6. **Check dependencies**: Are useEffect dependencies causing infinite loops?

### Console Debugging

Add this to App.tsx temporarily to debug state:

```typescript
useEffect(() => {
  console.log('Wallet State:', {
    mode: walletMode,
    isReady: walletConfig.isReady,
    isInitialized: browserWallet.isInitialized,
    activeAddress: walletConfig.activeAddress,
    hasSigner: !!walletConfig.activeSigner,
    providerType: walletConfig.activeProvider?.constructor.name,
  });
}, [walletMode, walletConfig, browserWallet.isInitialized]);
```
