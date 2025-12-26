# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plaza Gossip is a decentralized chat application on Polkadot Asset Hub featuring on-chain user profiles, multiple chat channels, and gasless messaging via session wallets (delegate pattern).

**Live Demo:** https://tomen.github.io/plaza-gossip/

## Build & Development Commands

### Contracts (`contracts/` directory)
```bash
npm test                    # Run all 159 tests (Hardhat + Chai)
npm run compile             # Compile Solidity contracts
npm run deploy:localhost    # Deploy to local Hardhat node
npm run deploy:polkadot     # Deploy to Polkadot Asset Hub testnet
npm run node                # Start local Hardhat node
```

### Frontend (`frontend/` directory)
```bash
npm run dev                 # Start Vite dev server (port 5173)
npm run build               # TypeScript compile + Vite build
npm run build:deploy        # Build with contract address injection for GitHub Pages
npm run lint                # ESLint check
npm run preview             # Preview production build
```

## Architecture

### Contract Hierarchy
```
UserRegistry (profiles, delegates, session public keys for ECDH)
     │
     ├── ChatChannel (public messages, resolves delegates to profile owners)
     │        │
     │        └── ChannelRegistry (channel factory & discovery)
     │
     └── DMConversation (encrypted 1-on-1 messages between two participants)
              │
              └── DMRegistry (DM conversation factory & discovery)
```

### Delegate Wallet System (Gasless UX)
The app uses a delegate pattern to enable gasless messaging:
1. User's main wallet authorizes a session wallet as delegate (one-time on-chain tx)
2. Session wallet is funded with small amount (~0.05 PAS)
3. Messages are signed by session wallet automatically
4. UserRegistry resolves delegate addresses to profile owners

### Encrypted DMs (ECDH + AES-GCM)
Private 1-on-1 messaging uses end-to-end encryption:
1. Each user has a **session public key** stored on-chain (separate from delegate wallet)
2. Messages encrypted using ECDH shared secret + AES-256-GCM
3. Only the two participants can decrypt messages
4. Session keys stored in localStorage, support rotation with pending key acknowledgment

**Encryption Flow:**
```
Alice → Bob:
1. Alice reads Bob's sessionPublicKey from UserRegistry
2. sharedSecret = ECDH(alice.privateKey, bob.publicKey)
3. ciphertext = AES-GCM(sharedSecret, plaintext)
4. Post ciphertext to DMConversation contract
```

### Dual Wallet Modes
- **Browser Mode:** MetaMask + auto-generated session wallet for gasless messaging
- **Standalone Mode:** In-app wallet for users without MetaMask (private key stored in localStorage)

### Frontend Data Flow
```
App.tsx (wallet state, view mode, routing)
   → useDeployments (loads contract addresses from deployments.json)
   → Custom hooks:
      - Channels: useWallet, useAppWallet, useUserRegistry, useChannel, useChannelRegistry
      - DMs: useDMRegistry, useDMConversation, useSessionKeys
   → Contract ABIs (`frontend/src/contracts/`)
   → On-chain contracts
```

### DM Frontend Architecture
```
Sidebar (CHANNELS/DMS tabs)
   → viewMode === 'channels' → ChannelHeader + ChatFeed + MessageInput
   → viewMode === 'dms' → DMConversationView (encrypted messages)

NewDMModal → dmRegistry.createConversation()
UserProfileModal → "SEND DM" button → handleStartDM()
```

### Key Files
- `frontend/src/App.tsx` - Main component, wallet orchestration, view mode (channels/DMs), URL parameter handling
- `frontend/src/hooks/useDeployments.ts` - Loads contract addresses from `public/deployments.json`
- `frontend/src/hooks/useAppWallet.ts` - Session/in-app wallet management
- `frontend/src/hooks/useDMRegistry.ts` - DM conversation management
- `frontend/src/hooks/useDMConversation.ts` - Encrypted message send/receive
- `frontend/src/hooks/useSessionKeys.ts` - ECDH session key management
- `frontend/src/components/Sidebar.tsx` - Channel/DM navigation with tab toggle
- `frontend/src/components/DMConversationView.tsx` - Encrypted DM chat interface
- `frontend/src/components/NewDMModal.tsx` - Start new DM conversation modal
- `frontend/src/utils/appWallet.ts` - Wallet storage (localStorage)
- `frontend/src/utils/crypto.ts` - ECDH key exchange + AES-GCM encryption
- `frontend/src/utils/sessionKeys.ts` - Session key storage & rotation
- `frontend/src/utils/contracts.ts` - Contract initialization
- `contracts/scripts/deploy.js` - Deploys all contracts, saves to `deployments.json`
- `frontend/public/deployments.json` - Contract addresses (copied from root after deploy)

## Contract Details

### UserRegistry.sol
- Profile: displayName (≤50 chars), bio (≤500 chars), links (≤10, each ≤200 chars)
- Delegate authorization: `addDelegate(address)` / `removeDelegate(address)`
- Session keys (ECDH): `setSessionPublicKey(bytes)`, `getSessionPublicKey(address)`
- Key functions: `resolveToOwner(address)`, `canActAs(actor, owner)`

### ChatChannel.sol
- Two posting modes: `Open` (anyone), `Permissioned` (allowlisted)
- Messages: content (0-1000 chars), stores profileOwner & sender
- Automatically resolves delegate → owner via UserRegistry

### ChannelRegistry.sol
- Factory: `createChannel(name, description, postingMode)` creates and registers
- Discovery: `getAllChannels()`, `getChannelsByCreator(address)`

### DMRegistry.sol
- Factory: `createConversation(otherUser)` creates 1-on-1 DM conversation
- Lookup: `getConversation(user1, user2)`, `getConversations(user)`
- Prevents duplicate conversations between same pair of users

### DMConversation.sol
- Participants: Two immutable addresses set at creation
- Messages: encrypted content (≤2000 bytes), sender info, timestamp
- Access: Only participants (or their delegates) can post
- Query: `getMessages(start, count)`, `getLatestMessages(count)`

## Deployment

### Contract Deployment
1. Set `SEED_PHRASE` or `PRIVATE_KEY` in `contracts/.env`
2. Run `npm run deploy:polkadot` (or `deploy:localhost`)
3. Addresses saved to `deployments.json`

### GitHub Pages
- Workflow: `.github/workflows/deploy-pages.yml`
- Reads `deployments.json`, injects registry address into built HTML
- Frontend auto-redirects to `?registry=0x...` if no query params

## Testing

Tests are in `contracts/test/` using Hardhat + Chai:
- `UserRegistry.test.js` - Profile, delegate, & session key management
- `ChatChannel.test.js` - Messaging & permissions
- `ChannelRegistry.test.js` - Channel factory & discovery
- `DMRegistry.test.js` - DM conversation factory & lookup
- `DMConversation.test.js` - Encrypted messaging & participant access
- `OnChainChat.test.js` - Integration tests

Run single test file: `npx hardhat test test/UserRegistry.test.js`

## Configuration

- **Solidity:** 0.8.20 with optimizer (200 runs)
- **TypeScript:** Strict mode, ES2022 target
- **Networks:** hardhat (local), localhost (127.0.0.1:8545), polkadotAssetHub (testnet, chainId 420420422)

## Important Notes

- Contract ABIs in `frontend/src/contracts/` must be manually updated after contract changes (copy from `contracts/artifacts/`)
- `deployments.json` at project root is created by deploy script; copy to `frontend/public/` for frontend to load
- Frontend auto-loads contract addresses from `deployments.json`; URL params (`?registry=`, `?dmRegistry=`) override
- Wallet private keys and ECDH session keys are stored in localStorage (inherent browser security limitations)
- Session keys auto-initialize when user first accesses DMs tab (requires profile)
