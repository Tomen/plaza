// ============ UserRegistry Types ============

export interface Link {
  name: string;
  url: string;
}

export interface Profile {
  owner: string;
  displayName: string;
  bio: string;
  exists: boolean;
}

// ============ ChatChannel Types ============

// On-chain posting mode (stored in contract)
export const PostingMode = {
  Open: 0,
  Permissioned: 1,
} as const;

export type PostingMode = (typeof PostingMode)[keyof typeof PostingMode];

// Channel type for creation UI (includes unlisted option)
export const ChannelType = {
  Open: 'open',           // Anyone can post, listed in registry
  Permissioned: 'permissioned',  // Only allowed posters, listed in registry
  Unlisted: 'unlisted',   // Anyone can post, NOT listed in registry
} as const;

export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];

export interface Message {
  profileOwner: string;
  sender: string;
  content: string;
  timestamp: bigint;
}

export interface FormattedMessage {
  profileOwner: string;
  sender: string;
  content: string;
  timestamp: number;
  formattedTime: string;
  displayName?: string;
}

export interface ChannelInfo {
  name: string;
  description: string;
  motd: string;
  owner: string;
  postingMode: PostingMode;
  messageCount: bigint;
}

// ============ ChannelRegistry Types ============

export interface RegisteredChannel {
  channelAddress: string;
  registeredBy: string;
  registeredAt: bigint;
}

// ============ App Wallet Types ============

export interface StoredWallet {
  privateKey: string;
  address: string;
  authorizedFor: string;
  createdAt: number;
}

// ============ UserPosts Types ============

export interface UserPost {
  index: number;
  profileOwner: string;
  sender: string;
  content: string;
  timestamp: number;
  editedAt: number | null;
  isDeleted: boolean;
  displayName?: string;
}

// ============ Replies Types ============

export interface Reply {
  index: number;
  parentId: string;
  profileOwner: string;
  sender: string;
  content: string;
  timestamp: number;
  editedAt: number | null;
  isDeleted: boolean;
  parentReplyIndex: number; // 0 for top-level, 1-indexed for nested
  depth: number;
  displayName?: string;
  children?: Reply[];
}

// ============ Voting Types ============

export const VoteType = {
  None: 0,
  Up: 1,
  Down: 2,
} as const;

export type VoteType = (typeof VoteType)[keyof typeof VoteType];

export interface VoteTally {
  upvotes: number;
  downvotes: number;
  score: number;
}

// ============ ForumThread Types ============

export interface ForumThread {
  index: number;
  author: string;
  sender: string;
  title: string;
  content: string;
  timestamp: number;
  editedAt: number | null;
  isDeleted: boolean;
  tags: string[];
  displayName?: string;
}
