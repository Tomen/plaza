# Deployment Guide

This guide explains how to deploy the On-Chain Chat contracts and frontend to GitHub Pages.

## Overview

The deployment process has two parts:
1. **Contract Deployment** (manual) - Deploy smart contracts to blockchain
2. **Frontend Deployment** (automatic) - GitHub Actions builds and deploys the UI

## Contract Deployment

### 1. Deploy Contracts

Deploy contracts to Polkadot Asset Hub testnet:

```bash
cd contracts
npm run deploy -- --network polkadotAssetHub
```

Or deploy locally for testing:

```bash
npm run deploy
```

### 2. Verify Deployment

The deploy script automatically saves contract addresses to `deployments.json` in the project root:

```json
{
  "polkadot-asset-hub-testnet": {
    "network": "Polkadot Asset Hub Testnet",
    "chainId": 420420422,
    "rpcUrl": "https://testnet-passet-hub-eth-rpc.polkadot.io",
    "userRegistry": "0x...",
    "channelRegistry": "0x...",
    "channels": {
      "general": "0x..."
    },
    "deployedAt": "2025-12-25T12:00:00Z"
  }
}
```

### 3. Commit Deployment Info

```bash
git add deployments.json
git commit -m "Deploy contracts to testnet"
git push origin main
```

## Frontend Deployment

### Local Testing (Recommended)

Before pushing to GitHub, test the deployment build locally:

```bash
cd frontend

# Build with auto-redirect
npm run build:deploy

# Serve the built site
npm run preview:dist
```

Visit http://localhost:3000 and verify:
- Auto-redirects to `?registry=0x...`
- App loads and connects to the correct contract
- You can connect wallet and interact with the chat

### GitHub Pages Deployment

#### First Time Setup

1. Go to your GitHub repository
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the settings

#### Deploy

Push to the main branch:

```bash
git push origin main
```

GitHub Actions will automatically:
1. Checkout the code
2. Read `deployments.json`
3. Build the frontend with auto-redirect to the registry address
4. Deploy to GitHub Pages

Monitor the deployment:
1. Go to **Actions** tab in your GitHub repository
2. Watch the "Deploy to GitHub Pages" workflow
3. Once complete, your site will be live!

### Access Your Deployed Site

Visit: `https://YOUR_USERNAME.github.io/image-store/`

The site will automatically redirect to: `https://YOUR_USERNAME.github.io/image-store/?registry=0x...`

## Updating Contract Addresses

If you redeploy contracts:

1. Deploy contracts (updates `deployments.json`)
2. Commit and push changes
3. GitHub Pages rebuilds automatically with new addresses

## Multiple Networks

`deployments.json` can store multiple network deployments:

```json
{
  "polkadot-asset-hub-testnet": { ... },
  "local-hardhat": { ... },
  "mainnet": { ... }
}
```

### Specify Network for Build

By default, the build uses the first network in `deployments.json`. To specify a different network:

```bash
DEPLOY_NETWORK=local-hardhat npm run build:deploy
```

For GitHub Actions, update the workflow file `.github/workflows/deploy-pages.yml`:

```yaml
- name: Build with auto-redirect
  working-directory: ./frontend
  env:
    VITE_BASE_PATH: /image-store/
    DEPLOY_NETWORK: polkadot-asset-hub-testnet  # Add this line
  run: npm run build:deploy
```

## Repository Name

The workflow uses `/image-store/` as the base path. If your repository name is different, update `.github/workflows/deploy-pages.yml`:

```yaml
env:
  VITE_BASE_PATH: /YOUR-REPO-NAME/
```

## Manual Registry Override

Users can still manually specify a different registry:

```
https://YOUR_USERNAME.github.io/image-store/?registry=0xOTHER_ADDRESS
```

The auto-redirect only happens when NO query parameters are present.

## Troubleshooting

### Build Fails: "deployments.json not found"

Solution: Deploy contracts first to create `deployments.json`

```bash
cd contracts
npm run deploy
```

### Build Fails: "No channelRegistry address found"

Solution: Check that `deployments.json` has the correct structure with `channelRegistry` field

### Site Doesn't Redirect

1. Check the deployed `index.html` has the redirect script
2. Clear browser cache
3. Try in incognito mode
4. Check browser console for errors

### Wrong Registry Address

1. Redeploy contracts to update `deployments.json`
2. Commit and push changes
3. Wait for GitHub Actions to rebuild

## Development Workflow

1. **Local Development**: `npm run dev` in frontend folder
2. **Test Contract Deployment**: Deploy locally, test with `?registry=LOCAL_ADDRESS`
3. **Deploy to Testnet**: Deploy contracts to testnet
4. **Test Production Build**: `npm run build:deploy && npm run preview:dist`
5. **Deploy to GitHub Pages**: Push to main branch

## Environment Variables

### Deploy Script

- `DEPLOY_NETWORK`: Network name from `deployments.json` (default: first network)

### Vite Build

- `VITE_BASE_PATH`: Base path for assets (default: `/`, GitHub Pages uses `/image-store/`)

## Files Reference

- **deployments.json** - Contract addresses (committed to repo)
- **frontend/scripts/build-with-redirect.js** - Build script that injects redirect
- **.github/workflows/deploy-pages.yml** - GitHub Actions workflow
- **frontend/vite.config.ts** - Vite configuration with base path support

## Security Notes

- `deployments.json` contains public contract addresses (safe to commit)
- Never commit private keys or seed phrases
- `.env` files are gitignored by default
- GitHub Actions only needs to read `deployments.json` (no secrets required)
