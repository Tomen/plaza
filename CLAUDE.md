# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plaza is a decentralized social platform on Polkadot Asset Hub featuring on-chain user profiles, chat channels, encrypted DMs, profile posts, and gasless messaging via session wallets (delegate pattern).

**Live Demo:** https://tomen.github.io/plaza/

## Quick Start

### Contracts (`contracts/`)
```bash
npm test              # Run tests
npm run compile       # Compile contracts
npm run deploy:polkadot   # Deploy to testnet
```

### Frontend (`frontend/`)
```bash
npm run dev           # Start dev server (port 5173)
npm run build         # Build for production
```

See subdirectory `CLAUDE.md` files for detailed documentation.

## Contract Hierarchy

```
UserRegistry (profiles, delegates, session keys)
     |
     +-- ChatChannel → ChannelRegistry (public messaging)
     |
     +-- DMConversation → DMRegistry (encrypted 1-on-1)
     |
     +-- UserPosts (profile posts)
     |
     +-- Replies (shared threading system)
     |
     +-- Voting (shared voting system)
```

## Core Concepts

### Delegate Wallet System (Gasless UX)
1. User's main wallet authorizes a session wallet as delegate (one-time tx)
2. Session wallet is funded with small amount (~0.05 PAS)
3. Messages are signed by session wallet automatically
4. UserRegistry resolves delegate addresses to profile owners

### Encrypted DMs (ECDH + AES-GCM)
1. Each user has a session public key stored on-chain
2. Messages encrypted using ECDH shared secret + AES-256-GCM
3. Only participants can decrypt messages
4. Session keys stored in localStorage

### Dual Wallet Modes
- **Browser Mode:** MetaMask + auto-generated session wallet
- **Standalone Mode:** In-app wallet for users without MetaMask

## Detailed Documentation

| Directory | File | Purpose |
|-----------|------|---------|
| `contracts/` | `CLAUDE.md` | Contract details, testing, deployment |
| `frontend/` | `CLAUDE.md` | Hooks, components, URL persistence |
| `frontend/docs/` | `architecture.md` | Deep technical docs, patterns |
| `frontend/docs/` | `user-flow.md` | User flows, troubleshooting |
| `frontend/docs/` | `STYLE_GUIDE.md` | UI patterns, styling |

## Important Notes

- Contract ABIs must be manually copied to `frontend/src/contracts/` after contract changes
- `deployments.json` is auto-copied to `frontend/public/` by deploy script
- Frontend loads contract addresses from `deployments.json`; URL params override
