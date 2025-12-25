# On-Chain Chat

A decentralized chat application with user profiles, multiple channels, and gasless messaging via delegated wallets. Built for Polkadot Asset Hub.

## Quick Start

### 1. Get Testnet Tokens

Visit https://faucet.polkadot.io/?parachain=1111 and request PAS tokens for your wallet.

### 2. Deploy Contracts

```bash
cd contracts
npm install
echo 'SEED_PHRASE=your twelve word seed phrase here' > .env
npx hardhat run scripts/deploy.js --network polkadotAssetHub
```

Save the output addresses:
- UserRegistry
- ChannelRegistry
- #general channel

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Open App

```
http://localhost:5173/?registry=<ChannelRegistryAddress>
```

---

## Architecture

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| `UserRegistry` | User profiles, display names, bios, social links, delegate management |
| `ChatChannel` | Individual chat channels with messages and permissions |
| `ChannelRegistry` | Channel discovery, registration, and factory |

### Delegate System (Gasless UX)

Users authorize an app-generated "session wallet" to sign transactions on their behalf. This eliminates MetaMask popups for every message:

1. User connects main wallet
2. App generates a session wallet (stored in localStorage)
3. User authorizes session wallet as delegate (one-time tx)
4. User funds session wallet with small amount of PAS
5. All messages are signed by session wallet automatically

---

## Detailed Setup

### Prerequisites

- Node.js v18+
- MetaMask browser extension
- PAS tokens from faucet

### Contract Deployment

#### Local Development

Terminal 1 - Start local blockchain:
```bash
cd contracts
npm install
npx hardhat node
```

Terminal 2 - Deploy:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```

#### Polkadot Asset Hub Testnet

```bash
cd contracts
npm install

# Create .env with your seed phrase
echo 'SEED_PHRASE=your twelve word seed phrase here' > .env

# Deploy
npx hardhat run scripts/deploy.js --network polkadotAssetHub
```

Network details:
- RPC: `https://testnet-passet-hub-eth-rpc.polkadot.io`
- Chain ID: `420420422`
- Faucet: https://faucet.polkadot.io/?parachain=1111

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Access via URL parameters:
- `?registry=0x...` - Load channel list from registry
- `?channel=0x...` - Direct link to specific channel

### MetaMask Configuration

Add Polkadot Asset Hub Testnet:
- Network Name: `Polkadot Asset Hub Testnet`
- RPC URL: `https://testnet-passet-hub-eth-rpc.polkadot.io`
- Chain ID: `420420422`
- Currency Symbol: `PAS`

---

## Usage

### First-Time Setup

1. **Connect Wallet** - Click "Connect Wallet" button
2. **Create Profile** - Enter display name and bio
3. **Setup Session** - Authorize session wallet and fund with ~0.05 PAS
4. **Start Chatting** - Messages are sent instantly without popups

### Creating Channels

1. Click "+ NEW CHANNEL" in sidebar
2. Enter channel name and description
3. Choose posting mode:
   - **Open** - Anyone with a profile can post
   - **Private** - Only approved users can post

### Session Wallet

The session wallet balance is shown in the header. When low:
1. Click "LOW - TOP UP"
2. Send additional PAS from your main wallet
3. Continue messaging

---

## Project Structure

```
├── contracts/
│   ├── contracts/
│   │   ├── UserRegistry.sol      # Profiles & delegates
│   │   ├── ChatChannel.sol       # Channel & messages
│   │   └── ChannelRegistry.sol   # Channel factory
│   ├── test/                     # 91 tests
│   └── scripts/deploy.js
│
├── frontend/
│   ├── src/
│   │   ├── components/           # UI components
│   │   ├── hooks/                # React hooks
│   │   │   ├── useWallet.ts
│   │   │   ├── useUserRegistry.ts
│   │   │   ├── useChannel.ts
│   │   │   ├── useChannelRegistry.ts
│   │   │   └── useAppWallet.ts
│   │   ├── utils/
│   │   │   ├── appWallet.ts      # Session wallet management
│   │   │   └── formatters.ts
│   │   └── contracts/            # ABIs
│   └── ...
```

---

## Development

### Run Contract Tests

```bash
cd contracts
npm test
```

All 91 tests cover:
- Profile creation and updates
- Delegate management
- Message posting (open & permissioned modes)
- Channel creation and registration
- Admin/owner permissions

### Build Frontend

```bash
cd frontend
npm run build
```

### Compile Contracts

```bash
cd contracts
npx hardhat compile
```

After compiling, copy ABIs to frontend:
```bash
cp artifacts/contracts/UserRegistry.sol/UserRegistry.json ../frontend/src/contracts/
cp artifacts/contracts/ChatChannel.sol/ChatChannel.json ../frontend/src/contracts/
cp artifacts/contracts/ChannelRegistry.sol/ChannelRegistry.json ../frontend/src/contracts/
```

---

## Contract API

### UserRegistry

```solidity
// Profile management
createProfile(displayName, bio)
setDisplayName(displayName)
setBio(bio)

// Links
addLink(name, url)
removeLink(index)
clearLinks()

// Delegates
addDelegate(address)
removeDelegate(address)

// Lookups
getProfile(address) → Profile
resolveToOwner(address) → address  // Resolves delegate to owner
hasProfile(address) → bool
```

### ChatChannel

```solidity
// Messaging
postMessage(content) → index

// Retrieval
getMessage(index) → Message
getMessages(start, count) → Message[]
getLatestMessages(count) → Message[]
getMessageCount() → uint256

// Management (owner/admin)
setName(name)
setDescription(description)
setMessageOfTheDay(motd)
setPostingMode(mode)
promoteAdmin(address)
addAllowedPoster(address)
```

### ChannelRegistry

```solidity
// Factory
createChannel(name, description, postingMode) → (address, index)
registerChannel(address) → index

// Queries
getChannelCount() → uint256
getChannel(index) → ChannelInfo
getAllChannels() → ChannelInfo[]
getChannelsByCreator(address) → uint256[]
```

---

## Security Notes

- Messages are permanent and public
- Maximum message length: 1000 characters
- Maximum display name: 50 characters
- Maximum bio: 500 characters
- Maximum links per profile: 10
- Session wallet private key is stored in localStorage

---

## License

ISC
