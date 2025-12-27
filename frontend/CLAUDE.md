# Frontend - Claude Code Guide

React frontend for Plaza, a decentralized social platform.

## Commands

```bash
npm run dev                 # Start Vite dev server (port 5173)
npm run build               # TypeScript compile + Vite build
npm run build:deploy        # Build with contract address injection for GitHub Pages
npm run lint                # ESLint check
npm run preview             # Preview production build
```

## URL Parameters & Persistence

The app uses URL parameters for deep linking and state persistence.

### Registry Addresses
- `?registry=0x...` - ChannelRegistry address
- `?dmRegistry=0x...` - DMRegistry address
- `?followRegistry=0x...` - FollowRegistry address

If not provided, addresses are loaded from `public/deployments.json`.

### View Parameters

| Parameter | View Mode | Description |
|-----------|-----------|-------------|
| `?channel=0x...` | channels | Shows specific channel |
| `?dm=0x...` | dms | Shows specific DM conversation |
| `?profile=0x...` | profile | Shows user profile (inline overlay) |

### Profile URL Behavior

When clicking a user in chat or user list:
1. URL updates to `?profile=0x...` via `pushState`
2. Previous state saved (viewMode, channel/dm address)
3. Profile overlay appears over main content (not full screen)
4. Browser back button returns to previous view
5. Closing profile (x button) restores previous URL

**Implementation:** `App.tsx` - `openProfile()` callback handles URL updates and `previousViewState` tracking.

### URL Persistence Config

By default, registry addresses are hidden from URL unless:
- User provided them in initial URL, OR
- `VITE_SHOW_REGISTRY_IN_URL=true` is set

## Key Hooks

| Hook | Purpose |
|------|---------|
| `useWallet` | Browser wallet connection (MetaMask) |
| `useAppWallet` | In-app wallet management (both modes) |
| `useUserRegistry` | Profile CRUD, delegate management |
| `useChannelRegistry` | Channel listing, creation |
| `useChannel` | Message loading, posting, moderation |
| `useDMRegistry` | DM conversation management |
| `useDMConversation` | Encrypted message send/receive |
| `useSessionKeys` | ECDH session key management |
| `useFollowRegistry` | Following/follower management |
| `useUserPosts` | Profile posts CRUD |
| `useReplies` | Threaded replies |
| `useVoting` | Upvote/downvote system |

## Key Components

| Component | Purpose |
|-----------|---------|
| `App.tsx` | Main component, wallet orchestration, view routing |
| `Sidebar.tsx` | Channel/DM/Following navigation |
| `ChatFeed.tsx` | Message display |
| `MessageInput.tsx` | Message composition |
| `UserProfileModal.tsx` | Inline profile overlay |
| `ProfileView.tsx` | Full profile view (from Following) |
| `DMConversationView.tsx` | Encrypted DM chat |

## Wallet Modes

| Mode | Provider | Signer | Use Case |
|------|----------|--------|----------|
| `browser` | BrowserProvider | provider.getSigner() | MetaMask users |
| `standalone` | JsonRpcProvider | ethers.Wallet | No extension needed |
| `none` | null | null | Not connected |

**Key:** `walletConfig` (useMemo) provides unified access regardless of mode.

## Detailed Documentation

See `docs/` for in-depth documentation:
- `docs/architecture.md` - Hook patterns, state flow, common pitfalls
- `docs/user-flow.md` - User flows, wallet flows, troubleshooting
- `docs/STYLE_GUIDE.md` - UI styling patterns and components
