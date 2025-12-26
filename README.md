# On-Chain Chat

**🌐 Live Demo:** https://tomen.github.io/plaza-gossip/

**WARNING: This solution is vibe coded and not considered safe for production use (although we do not suspect any issues). Use at your own risk and verify each transaction you sign!**

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

The frontend automatically loads contract addresses from `deployments.json`:
```
http://localhost:5173
```

Or override with URL parameters:
```
http://localhost:5173/?registry=<ChannelRegistryAddress>&dmRegistry=<DMRegistryAddress>
```

---

## Architecture

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| `UserRegistry` | User profiles, display names, bios, social links, delegate management, session public keys |
| `ChatChannel` | Individual chat channels with messages and permissions |
| `ChannelRegistry` | Channel discovery, registration, and factory |
| `DMConversation` | Private 1-on-1 encrypted messaging between two users |
| `DMRegistry` | DM conversation discovery and factory |

### Delegate System (Gasless UX)

Users authorize an app-generated "session wallet" to sign transactions on their behalf. This eliminates MetaMask popups for every message:

1. User connects main wallet
2. App generates a session wallet (stored in localStorage)
3. User authorizes session wallet as delegate (one-time tx)
4. User funds session wallet with small amount of PAS
5. All messages are signed by session wallet automatically

### Encrypted DMs (End-to-End Encryption)

Private 1-on-1 messages use ECDH key exchange + AES-256-GCM encryption:

1. Each user stores a **session public key** on-chain (separate from delegate wallet)
2. Sender derives shared secret: `ECDH(myPrivateKey, theirPublicKey)`
3. Message encrypted with AES-GCM using the shared secret
4. Only participants can decrypt - encryption keys never transmitted

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

The frontend automatically loads contract addresses from `deployments.json` (created during deployment). URL parameters can override:
- `?registry=0x...` - Override channel registry address
- `?dmRegistry=0x...` - Override DM registry address
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

### Sending Direct Messages

1. Click the **DMS** tab in the sidebar
2. Click **+ NEW DM** to start a new conversation
3. Enter the recipient's wallet address
4. Your session key is auto-initialized on first use
5. Messages are end-to-end encrypted

Alternatively, click a user's name in a channel → **SEND DM** button.

**Note:** The recipient must have set up their session key to decrypt your messages.

---

## Project Structure

```
├── contracts/
│   ├── contracts/
│   │   ├── UserRegistry.sol      # Profiles, delegates & session keys
│   │   ├── ChatChannel.sol       # Channel & messages
│   │   ├── ChannelRegistry.sol   # Channel factory
│   │   ├── DMConversation.sol    # Encrypted 1-on-1 messages
│   │   └── DMRegistry.sol        # DM factory
│   ├── test/                     # 159 tests
│   └── scripts/deploy.js
│
├── frontend/
│   ├── public/
│   │   └── deployments.json      # Contract addresses (copied from root)
│   ├── src/
│   │   ├── components/           # UI components
│   │   │   ├── Sidebar.tsx       # Channel/DM navigation tabs
│   │   │   ├── DMConversationView.tsx  # Encrypted DM chat view
│   │   │   ├── NewDMModal.tsx    # Start new DM conversation
│   │   │   └── ...
│   │   ├── hooks/                # React hooks
│   │   │   ├── useWallet.ts
│   │   │   ├── useUserRegistry.ts
│   │   │   ├── useChannel.ts
│   │   │   ├── useChannelRegistry.ts
│   │   │   ├── useAppWallet.ts
│   │   │   ├── useDeployments.ts     # Load contract addresses from JSON
│   │   │   ├── useDMRegistry.ts      # DM conversation management
│   │   │   ├── useDMConversation.ts  # Encrypted messaging
│   │   │   └── useSessionKeys.ts     # ECDH key management
│   │   ├── utils/
│   │   │   ├── appWallet.ts      # Session wallet management
│   │   │   ├── crypto.ts         # ECDH + AES-GCM encryption
│   │   │   ├── sessionKeys.ts    # Session key storage
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

All 159 tests cover:
- Profile creation and updates
- Delegate management
- Session public key management
- Message posting (open & permissioned modes)
- Channel creation and registration
- Admin/owner permissions
- DM conversation creation and lookup
- Encrypted message posting and retrieval

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
cp artifacts/contracts/DMRegistry.sol/DMRegistry.json ../frontend/src/contracts/
cp artifacts/contracts/DMConversation.sol/DMConversation.json ../frontend/src/contracts/
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

// Session Keys (for encrypted DMs)
setSessionPublicKey(bytes)         // 64-byte secp256k1 public key
clearSessionPublicKey()
getSessionPublicKey(address) → bytes
hasSessionPublicKey(address) → bool

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

### DMRegistry

```solidity
// Factory
createConversation(otherUser) → address

// Queries
getConversations(user) → address[]
getConversation(user1, user2) → address
conversationExists(user1, user2) → bool
```

### DMConversation

```solidity
// Messaging
postMessage(encryptedContent) → index

// Retrieval
getMessage(index) → EncryptedMessage
getMessages(start, count) → EncryptedMessage[]
getLatestMessages(count) → EncryptedMessage[]
getMessageCount() → uint256

// Info
getConversationInfo() → (participant1, participant2, messageCount)
isParticipant(address) → bool
```

---

## Security Notes

- Channel messages are permanent and public on-chain
- DM messages are encrypted (only participants can read)
- Maximum channel message length: 1000 characters
- Maximum DM encrypted content: 2000 bytes
- Maximum display name: 50 characters
- Maximum bio: 500 characters
- Maximum links per profile: 10
- Session wallet private key stored in localStorage
- ECDH session private key stored in localStorage
- DM metadata (who talks to whom) is visible on-chain

---

## License

ISC
