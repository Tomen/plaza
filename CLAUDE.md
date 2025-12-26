# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plaza Gossip is a decentralized chat application on Polkadot Asset Hub featuring on-chain user profiles, multiple chat channels, and gasless messaging via session wallets (delegate pattern).

**Live Demo:** https://tomen.github.io/plaza-gossip/

## Build & Development Commands

### Contracts (`contracts/` directory)
```bash
npm test                    # Run all 91 tests (Hardhat + Chai)
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
UserRegistry (profiles & delegates)
     ↓
ChatChannel (messages, references UserRegistry for sender resolution)
     ↓
ChannelRegistry (factory & discovery, references UserRegistry)
```

### Delegate Wallet System (Gasless UX)
The app uses a delegate pattern to enable gasless messaging:
1. User's main wallet authorizes a session wallet as delegate (one-time on-chain tx)
2. Session wallet is funded with small amount (~0.05 PAS)
3. Messages are signed by session wallet automatically
4. UserRegistry resolves delegate addresses to profile owners

### Dual Wallet Modes
- **Browser Mode:** MetaMask + auto-generated session wallet for gasless messaging
- **Standalone Mode:** In-app wallet for users without MetaMask (private key stored in localStorage)

### Frontend Data Flow
```
App.tsx (wallet state, routing)
   → Custom hooks (useWallet, useAppWallet, useUserRegistry, useChannel, useChannelRegistry)
      → Contract ABIs (`frontend/src/contracts/`)
         → On-chain contracts
```

### Key Files
- `frontend/src/App.tsx` - Main component, wallet orchestration, URL parameter handling
- `frontend/src/hooks/useAppWallet.ts` - Session/in-app wallet management
- `frontend/src/utils/appWallet.ts` - Wallet storage (localStorage)
- `frontend/src/utils/contracts.ts` - Contract initialization
- `contracts/scripts/deploy.js` - Deploys all contracts, saves to `deployments.json`

## Contract Details

### UserRegistry.sol
- Profile: displayName (≤50 chars), bio (≤500 chars), links (≤10, each ≤200 chars)
- Delegate authorization: `addDelegate(address)` / `removeDelegate(address)`
- Key functions: `resolveToOwner(address)`, `canActAs(actor, owner)`

### ChatChannel.sol
- Two posting modes: `Open` (anyone), `Permissioned` (allowlisted)
- Messages: content (0-1000 chars), stores profileOwner & sender
- Automatically resolves delegate → owner via UserRegistry

### ChannelRegistry.sol
- Factory: `createChannel(name, description, postingMode)` creates and registers
- Discovery: `getAllChannels()`, `getChannelsByCreator(address)`

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
- `UserRegistry.test.js` - Profile & delegate management
- `ChatChannel.test.js` - Messaging & permissions
- `ChannelRegistry.test.js` - Channel factory & discovery
- `OnChainChat.test.js` - Integration tests

Run single test file: `npx hardhat test test/UserRegistry.test.js`

## Configuration

- **Solidity:** 0.8.20 with optimizer (200 runs)
- **TypeScript:** Strict mode, ES2022 target
- **Networks:** hardhat (local), localhost (127.0.0.1:8545), polkadotAssetHub (testnet, chainId 420420422)

## Important Notes

- Contract ABIs in `frontend/src/contracts/` must be manually updated after contract changes (copy from `contracts/artifacts/`)
- `deployments.json` must exist for GitHub Pages build to work
- Wallet private keys are stored in localStorage (inherent browser security limitations)
- URL parameters: `?registry=0x...` or `?channel=0x...` for direct linking
