# Contracts - Claude Code Guide

Smart contracts for Plaza, a decentralized social platform on Polkadot Asset Hub.

## Commands

```bash
npm test                    # Run all tests (Hardhat + Chai)
npm run compile             # Compile Solidity contracts
npm run deploy:localhost    # Deploy to local Hardhat node
npm run deploy:polkadot     # Deploy to Polkadot Asset Hub testnet
npm run node                # Start local Hardhat node
```

Run single test: `npx hardhat test test/UserRegistry.test.js`

## Contract Hierarchy

```
UserRegistry (profiles, delegates, session public keys for ECDH)
     |
     +-- ChatChannel (public messages, resolves delegates to profile owners)
     |        |
     |        +-- ChannelRegistry (channel factory & discovery)
     |
     +-- DMConversation (encrypted 1-on-1 messages between two participants)
     |        |
     |        +-- DMRegistry (DM conversation factory & discovery)
     |
     +-- UserPosts (profile posts with create/edit/delete)
     |
     +-- Replies (shared reply system for posts, uses parentId hashing)
     |
     +-- Voting (shared voting system for posts/replies, uses entityId hashing)
```

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

### UserPosts.sol
- Profile posts: content (≤2000 chars), create/edit/delete
- Ownership: profileOwner (resolved from delegate), sender (actual signer)
- Query: `getUserPosts(user, offset, limit)`, `getLatestUserPosts(user, count)`
- Key functions: `createPost(content)`, `editPost(index, content)`, `deletePost(index)`

### Replies.sol (Shared)
- Threaded replies for any entity type (posts, forum threads, etc.)
- Uses `parentId = keccak256(contractAddress, entityType, entityIndex)` to group replies
- Supports nested replies via `parentReplyIndex` (0 = top-level, 1+ = nested)
- Key functions: `addReply(contract, type, index, content, parentReplyIndex)`, `editReply()`, `deleteReply()`
- Query: `getTopLevelReplies(parentId, offset, count)`, `getChildReplies(replyIndex, offset, count)`

### Voting.sol (Shared)
- Upvote/downvote system for any entity type
- Uses `entityId = keccak256(contractAddress, entityType, entityIndex)` to identify entities
- One vote per user per entity (can change or remove)
- Key functions: `vote(entityId, voteType)`, `removeVote(entityId)`
- Query: `getTally(entityId)` → (upvotes, downvotes), `getUserVote(entityId, user)`, `getScore(entityId)`

## Deployment

1. Set `SEED_PHRASE` or `PRIVATE_KEY` in `.env`
2. Run `npm run deploy:polkadot` (or `deploy:localhost`)
3. Addresses saved to `deployments.json` in project root
4. Copy to `frontend/public/deployments.json` for frontend to load

## Testing

Tests in `test/` using Hardhat + Chai:
- `UserRegistry.test.js` - Profile, delegate, & session key management
- `ChatChannel.test.js` - Messaging & permissions
- `ChannelRegistry.test.js` - Channel factory & discovery
- `DMRegistry.test.js` - DM conversation factory & lookup
- `DMConversation.test.js` - Encrypted messaging & participant access
- `UserPosts.test.js` - Post creation, editing, deletion, pagination
- `Replies.test.js` - Threaded replies, nesting, parent ID system
- `Voting.test.js` - Upvote/downvote, vote changes, tally queries
- `OnChainChat.test.js` - Integration tests

## Configuration

- **Solidity:** 0.8.20 with optimizer (200 runs)
- **Networks:** hardhat (local), localhost (127.0.0.1:8545), polkadotAssetHub (testnet, chainId 420420422)

## Important Notes

- Contract ABIs in `frontend/src/contracts/` must be manually updated after contract changes
- Copy from `artifacts/contracts/<Contract>.sol/<Contract>.json`
