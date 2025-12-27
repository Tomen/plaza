import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST DATA CONFIGURATION
// ============================================================================

const TEST_USERS = [
  {
    name: "Alice (Testing Bot)",
    bio: "This account posts test data.",
    links: [],
  },
  {
    name: "Bob (Testing Bot)",
    bio: "This account posts test data.",
    links: [],
  },
  {
    name: "Charlie (Testing Bot)",
    bio: "This account posts test data.",
    links: [],
  },
  {
    name: "Diana (Testing Bot)",
    bio: "This account posts test data.",
    links: [],
  },
  {
    name: "Eve (Testing Bot)",
    bio: "This account posts test data.",
    links: [],
  },
];

const CHANNELS = [
  {
    name: "general",
    description: "General discussion about Plaza and decentralized social",
    mode: 0,
  },
  {
    name: "dev",
    description: "Developer talk - smart contracts, frontend, and integrations",
    mode: 0,
  },
  {
    name: "announcements",
    description: "Official updates and news from the Plaza team",
    mode: 1,
  },
];

const CHANNEL_MESSAGES = {
  general: [
    { user: 0, content: "Welcome to Plaza! This is the first decentralized message." },
    { user: 1, content: "Hey everyone! Excited to be here. The UI looks great!" },
    { user: 2, content: "Just set up my session wallet. Gasless messaging is so smooth!" },
    { user: 3, content: "Love how everything is on-chain. True ownership of our social data." },
    { user: 4, content: "Has anyone tried the encrypted DMs yet? Very curious about the ECDH implementation." },
    { user: 0, content: "Yes! DMs work great. The encryption is handled client-side." },
    { user: 1, content: "Who else is building on Polkadot Asset Hub? Would love to collaborate." },
    { user: 2, content: "gm everyone!" },
    { user: 3, content: "gm! Another great day in the decentralized world." },
  ],
  dev: [
    { user: 1, content: "Anyone know how the delegate pattern works? Trying to understand the architecture." },
    { user: 0, content: "The delegate wallet signs transactions on behalf of the main wallet. Check UserRegistry.sol" },
    { user: 4, content: "The key is that delegates are authorized once, then can act freely within limits." },
    { user: 1, content: "Ah that makes sense! So the session wallet is funded separately?" },
    { user: 0, content: "Exactly. Small amount of PAS for gas, and it handles all the signing." },
    { user: 2, content: "Has anyone benchmarked the gas costs? Seems pretty efficient." },
    { user: 4, content: "Running some tests now. Will share results later." },
  ],
  announcements: [
    { user: 0, content: "Plaza v1.0 is now live on Polkadot Asset Hub testnet!" },
    { user: 0, content: "New feature: Forum threads are now available! Create discussions with categories." },
    { user: 0, content: "Reminder: This is testnet. Data may be reset during development." },
  ],
};

const FORUM_THREADS = [
  {
    tags: ["general", "welcome"],
    author: 0,
    title: "Welcome to Plaza Forums!",
    content:
      "Welcome to the Plaza community forums! This is a space for longer-form discussions, questions, and showcases.\n\nFeel free to introduce yourself and share what brought you to Plaza. We're building something special here - a truly decentralized social platform where you own your data.\n\nA few guidelines:\n- Be respectful and constructive\n- Help newcomers get started\n- Share your knowledge and learn from others\n\nLooking forward to great discussions!",
  },
  {
    tags: ["general", "guidelines"],
    author: 2,
    title: "Community Guidelines and Best Practices",
    content:
      "Let's establish some community norms as we grow.\n\n1. Be excellent to each other\n2. No spam or self-promotion without value\n3. Keep discussions on-topic\n4. Respect privacy - don't share others' info without consent\n5. Report bugs constructively\n\nWhat else should we add?",
  },
  {
    tags: ["help", "wallets"],
    author: 2,
    title: "How do session wallets work?",
    content:
      "I'm new to Plaza and trying to understand the session wallet system. From what I can tell:\n\n1. You connect your main wallet (MetaMask)\n2. A session wallet is generated\n3. You authorize it as a delegate\n4. It handles signing automatically?\n\nBut I'm confused about a few things:\n- Where is the session wallet stored?\n- What happens if I clear my browser data?\n- Is there a limit to what the delegate can do?\n\nThanks for any help!",
  },
  {
    tags: ["help", "bug"],
    author: 3,
    title: "Troubleshooting: Messages not appearing",
    content:
      "Having an issue where my messages aren't showing up in the chat feed. I've tried:\n\n- Refreshing the page\n- Reconnecting my wallet\n- Checking the console for errors\n\nNo errors in the console. Transaction seems to go through (I see it in the explorer). But the message doesn't appear in the feed.\n\nAnyone else experiencing this? Running Chrome on Windows.",
  },
  {
    tags: ["ideas", "ui"],
    author: 3,
    title: "Feature request: Dark mode",
    content:
      "Would love to see a dark mode option! The current retro terminal aesthetic is cool, but my eyes would appreciate a darker variant for late-night browsing.\n\nMaybe something like:\n- Darker background (#1a1a1a)\n- Softer green text\n- Same scanline effect\n\nWould this be difficult to implement?",
  },
  {
    tags: ["ideas", "notifications"],
    author: 4,
    title: "Should we add push notifications?",
    content:
      "I keep missing messages because I don't know when people reply. Would push notifications make sense for a decentralized app?\n\nSome considerations:\n- Privacy implications (who sends the push?)\n- Could use a decentralized notification service\n- Maybe just browser notifications when the tab is open?\n\nWhat do you all think?",
  },
  {
    tags: ["showcase", "integration"],
    author: 1,
    title: "My first dApp integration with Plaza",
    content:
      "Just finished building a simple integration that pulls Plaza profiles into my existing dApp!\n\nThe process was pretty straightforward:\n1. Import the UserRegistry ABI\n2. Call getProfile() with an address\n3. Display the name and bio\n\nCode snippet:\n```\nconst profile = await userRegistry.getProfile(address);\nconsole.log(profile.displayName, profile.bio);\n```\n\nPlanning to add more features soon. Happy to share the full source if anyone's interested!",
  },
  {
    tags: ["showcase", "security"],
    author: 4,
    title: "Security audit notes and recommendations",
    content:
      "Did a quick security review of the Plaza contracts. Overall, really solid work! Some observations:\n\n**Strengths:**\n- Clean separation of concerns\n- Proper access control on admin functions\n- No obvious reentrancy vulnerabilities\n- Good use of require statements\n\n**Suggestions:**\n- Consider adding rate limiting for message posting\n- Could add pausable functionality for emergencies\n- Documentation could be more detailed\n\nHappy to discuss any of these in more detail. Great work, team!",
  },
];

const USER_POSTS = [
  { user: 0, content: "Just deployed Plaza to testnet! Feeling accomplished. This is the start of something big." },
  { user: 0, content: "The delegate wallet pattern is really elegant. Users get gasless UX without sacrificing security." },
  { user: 0, content: "Working on some UI improvements today. The retro terminal look is coming together nicely." },
  { user: 1, content: "Deep diving into Solidity assembly today. Gas optimization is an art form." },
  { user: 1, content: "Hot take: On-chain social is the future. Web2 platforms had their chance." },
  { user: 1, content: "Just helped a newcomer set up their first wallet. Love this community!" },
  { user: 2, content: "Finally understand how ECDH encryption works in DMs. Mind = blown." },
  { user: 2, content: "The more I use Plaza, the more I appreciate true data ownership." },
  { user: 2, content: "gm to everyone building in the open. You're all amazing." },
  { user: 3, content: "Created my first NFT today! Minting on Polkadot was super smooth." },
  { user: 3, content: "Anyone else love the scanline effect on the UI? So nostalgic." },
  { user: 3, content: "Working on a digital art piece inspired by Plaza's aesthetic." },
  { user: 4, content: "Finished auditing another protocol. Security never sleeps." },
  { user: 4, content: "Reminder: Always verify contract addresses before interacting!" },
  { user: 4, content: "Found and responsibly disclosed a bug today. Feels good to help." },
];

// Replies for forum threads (threadIndex -> replies)
const THREAD_REPLIES = {
  0: [
    { user: 1, content: "Thanks for the warm welcome! Excited to be part of this community." },
    { user: 3, content: "The on-chain data ownership is what sold me. No more platform lock-in!" },
  ],
  2: [
    { user: 0, content: "Great questions! The session wallet is stored in localStorage. If you clear browser data, you'll need to authorize a new one. Delegates can only perform actions you explicitly allow." },
    { user: 4, content: "Adding to what Alice said - the delegate has limited permissions by design. It can post messages but can't transfer funds or change profile ownership." },
  ],
  3: [
    { user: 1, content: "This might be a caching issue. Try opening in incognito mode to rule that out." },
  ],
  4: [
    { user: 0, content: "Dark mode is definitely on the roadmap! Should be relatively straightforward with CSS variables." },
    { user: 1, content: "+1 for dark mode. My eyes would thank you." },
  ],
  7: [
    { user: 0, content: "This is incredibly valuable feedback! Would you be interested in doing a more formal audit?" },
    { user: 1, content: "Really appreciate the security review. The rate limiting suggestion is great." },
  ],
};

// Replies for user posts (postIndex -> replies)
const POST_REPLIES = {
  0: [
    { user: 1, content: "Congrats on the launch! Can't wait to see where this goes." },
  ],
  4: [
    { user: 0, content: "100% agree. The incentives are finally aligned with users." },
    { user: 4, content: "Web3 social is still early but the trajectory is clear." },
  ],
};

// Votes (entityType, entityIndex, votes array with user and voteType)
const ENTITY_TYPES = { USER_POST: 0, FORUM_THREAD: 2 };
const VOTE_TYPES = { UP: 1, DOWN: 2 };

const POST_VOTES = [
  { postIndex: 0, votes: [{ user: 1, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }, { user: 3, type: VOTE_TYPES.UP }] },
  { postIndex: 1, votes: [{ user: 2, type: VOTE_TYPES.UP }, { user: 4, type: VOTE_TYPES.UP }] },
  { postIndex: 4, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }, { user: 3, type: VOTE_TYPES.UP }, { user: 4, type: VOTE_TYPES.UP }] },
  { postIndex: 6, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 1, type: VOTE_TYPES.UP }] },
  { postIndex: 12, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 1, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }] },
];

const THREAD_VOTES = [
  { threadIndex: 0, votes: [{ user: 1, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }, { user: 3, type: VOTE_TYPES.UP }, { user: 4, type: VOTE_TYPES.UP }] },
  { threadIndex: 2, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 1, type: VOTE_TYPES.UP }] },
  { threadIndex: 4, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 1, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }] },
  { threadIndex: 6, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }, { user: 3, type: VOTE_TYPES.UP }] },
  { threadIndex: 7, votes: [{ user: 0, type: VOTE_TYPES.UP }, { user: 1, type: VOTE_TYPES.UP }, { user: 2, type: VOTE_TYPES.UP }, { user: 3, type: VOTE_TYPES.UP }] },
];

// Following relationships: [follower, ...following]
const FOLLOWING = [
  { follower: 1, follows: [0] },          // Bob follows Alice
  { follower: 2, follows: [0, 1] },       // Charlie follows Alice, Bob
  { follower: 3, follows: [0, 1, 2] },    // Diana follows Alice, Bob, Charlie
  { follower: 4, follows: [0, 1] },       // Eve follows Alice, Bob
  { follower: 0, follows: [1, 4] },       // Alice follows Bob, Eve
];

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("PLAZA TEST DATA SEEDING");
  console.log("=".repeat(60));

  // Load deployment addresses
  const deploymentsPath = path.join(__dirname, "../../deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.error("\n[ERROR] deployments.json not found!");
    console.error("Run deployment first: npm run deploy:localhost");
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const network = hre.network.name;
  const networkKey =
    network === "polkadotAssetHub"
      ? "polkadot-asset-hub-testnet"
      : network === "hardhat"
      ? "local-hardhat"
      : network === "localhost"
      ? "local-hardhat"
      : network;

  const addresses = deployments[networkKey];
  if (!addresses) {
    console.error(`\n[ERROR] No deployment found for network: ${networkKey}`);
    console.error("Available networks:", Object.keys(deployments).join(", "));
    process.exit(1);
  }

  console.log(`\nNetwork: ${network} (${networkKey})`);
  console.log(`Loaded addresses from deployments.json`);

  // Test wallet private keys for seeding
  const TEST_PRIVATE_KEYS = [
    "0xdd098a8a1cd142621ea24d19383c9e84ecf0cfa2dbf8180950b048738a71593a", // Alice
    "0x5ba4c2e076e738cb65de93f43fe9680c2cf61f0a40ffe3fc78a652ef0ad7c235", // Bob
    "0x624e562c3ac71348e5b15b11500de0b8c174df26c4b9693bef099c27d3c25c6c", // Charlie
    "0x7e20dcd1810872fbf16a7650c128f1904800ab2e22d15c8ade73cbe11dffcecc", // Diana
    "0x8a3c223fc7ce71d9358aa2419a08d7a80ca7107c675969935c166c12aad99c74", // Eve
  ];

  // Get signers - use test wallets if available, otherwise fall back to configured signers
  let users;
  const provider = hre.ethers.provider;

  // Try to use dedicated test wallets first
  const testWallets = TEST_PRIVATE_KEYS.map(key => new hre.ethers.Wallet(key, provider));
  const firstBalance = await provider.getBalance(testWallets[0].address);

  if (firstBalance > 0n) {
    users = testWallets;
    console.log(`\nUsing dedicated test wallets:`);
    for (let i = 0; i < users.length; i++) {
      const bal = await provider.getBalance(users[i].address);
      console.log(`  ${TEST_USERS[i].name}: ${users[i].address} (${hre.ethers.formatEther(bal)} PAS)`);
    }
  } else {
    // Fall back to hardhat signers (for local development)
    const signers = await hre.ethers.getSigners();
    if (signers.length >= 5) {
      users = signers.slice(0, 5);
      console.log(`\nUsing ${users.length} hardhat test accounts`);
    } else {
      console.error("\n[ERROR] No funded test wallets and not enough hardhat signers");
      process.exit(1);
    }
  }

  // Connect to contracts
  const userRegistry = await hre.ethers.getContractAt("UserRegistry", addresses.userRegistry);
  const channelRegistry = await hre.ethers.getContractAt("ChannelRegistry", addresses.channelRegistry);
  const followRegistry = await hre.ethers.getContractAt("FollowRegistry", addresses.followRegistry);
  const userPosts = await hre.ethers.getContractAt("UserPosts", addresses.userPosts);
  const forumThread = await hre.ethers.getContractAt("ForumThread", addresses.forumThread);
  const replies = await hre.ethers.getContractAt("Replies", addresses.replies);
  const voting = await hre.ethers.getContractAt("Voting", addresses.voting);

  // ========== 1. CREATE USER PROFILES ==========
  console.log("\n" + "-".repeat(40));
  console.log("1. Creating user profiles...");
  console.log("-".repeat(40));

  for (let i = 0; i < TEST_USERS.length; i++) {
    const userData = TEST_USERS[i];
    const signer = users[i];

    try {
      const hasProfile = await userRegistry.hasProfile(signer.address);
      if (hasProfile) {
        console.log(`   [SKIP] ${userData.name} already has a profile`);
        continue;
      }

      const tx = await userRegistry.connect(signer).createProfile(userData.name, userData.bio);
      await tx.wait();
      console.log(`   [OK] ${userData.name} (${signer.address.slice(0, 10)}...)`);

      // Add links
      for (const link of userData.links) {
        const linkTx = await userRegistry.connect(signer).addLink(link.name, link.url);
        await linkTx.wait();
      }
      if (userData.links.length > 0) {
        console.log(`        + ${userData.links.length} links added`);
      }
    } catch (err) {
      console.log(`   [ERROR] ${userData.name}: ${err.message}`);
    }
  }

  // ========== 2. SET UP FOLLOWING ==========
  console.log("\n" + "-".repeat(40));
  console.log("2. Setting up following relationships...");
  console.log("-".repeat(40));

  for (const rel of FOLLOWING) {
    const follower = users[rel.follower];
    const followerName = TEST_USERS[rel.follower].name;

    for (const followIndex of rel.follows) {
      const followee = users[followIndex];
      const followeeName = TEST_USERS[followIndex].name;

      try {
        const isFollowing = await followRegistry.isFollowing(follower.address, followee.address);
        if (isFollowing) {
          console.log(`   [SKIP] ${followerName} already follows ${followeeName}`);
          continue;
        }

        const tx = await followRegistry.connect(follower).follow(followee.address);
        await tx.wait();
        console.log(`   [OK] ${followerName} -> ${followeeName}`);
      } catch (err) {
        console.log(`   [ERROR] ${followerName} -> ${followeeName}: ${err.message}`);
      }
    }
  }

  // ========== 3. CREATE CHAT CHANNELS ==========
  console.log("\n" + "-".repeat(40));
  console.log("3. Creating chat channels...");
  console.log("-".repeat(40));

  const channelAddresses = {};

  for (const channelData of CHANNELS) {
    try {
      // Create channel (first user is creator for all)
      const tx = await channelRegistry
        .connect(users[0])
        .createChannel(channelData.name, channelData.description, channelData.mode);
      const receipt = await tx.wait();

      // Get channel address from event
      const event = receipt.logs.find((log) => {
        try {
          return channelRegistry.interface.parseLog(log)?.name === "ChannelRegistered";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = channelRegistry.interface.parseLog(event);
        channelAddresses[channelData.name] = parsed.args.channelAddress;
        console.log(`   [OK] #${channelData.name} (${parsed.args.channelAddress.slice(0, 10)}...)`);
      }
    } catch (err) {
      if (err.message.includes("already")) {
        console.log(`   [SKIP] #${channelData.name} already exists`);
      } else {
        console.log(`   [ERROR] #${channelData.name}: ${err.message}`);
      }
    }
  }

  // ========== 4. POST CHANNEL MESSAGES ==========
  console.log("\n" + "-".repeat(40));
  console.log("4. Posting channel messages...");
  console.log("-".repeat(40));

  for (const [channelName, messages] of Object.entries(CHANNEL_MESSAGES)) {
    const channelAddr = channelAddresses[channelName];
    if (!channelAddr) {
      console.log(`   [SKIP] #${channelName} - channel not created`);
      continue;
    }

    const channel = await hre.ethers.getContractAt("ChatChannel", channelAddr);
    let posted = 0;

    for (const msg of messages) {
      try {
        const tx = await channel.connect(users[msg.user]).postMessage(msg.content);
        await tx.wait();
        posted++;
      } catch (err) {
        console.log(`   [ERROR] #${channelName} message: ${err.message}`);
      }
    }

    console.log(`   [OK] #${channelName}: ${posted} messages posted`);
  }

  // ========== 5. CREATE FORUM THREADS ==========
  console.log("\n" + "-".repeat(40));
  console.log("5. Creating forum threads...");
  console.log("-".repeat(40));

  const threadIndices = [];

  for (let i = 0; i < FORUM_THREADS.length; i++) {
    const threadData = FORUM_THREADS[i];
    try {
      const tx = await forumThread
        .connect(users[threadData.author])
        .createThread(threadData.title, threadData.content, threadData.tags);
      await tx.wait();

      const count = await forumThread.getThreadCount();
      threadIndices.push(Number(count) - 1);
      console.log(`   [OK] "${threadData.title.slice(0, 40)}..."`);
    } catch (err) {
      console.log(`   [ERROR] Thread: ${err.message}`);
      threadIndices.push(-1);
    }
  }

  // ========== 6. CREATE USER POSTS ==========
  console.log("\n" + "-".repeat(40));
  console.log("6. Creating user posts...");
  console.log("-".repeat(40));

  const postIndices = [];

  for (let i = 0; i < USER_POSTS.length; i++) {
    const postData = USER_POSTS[i];
    try {
      const tx = await userPosts.connect(users[postData.user]).createPost(postData.content);
      await tx.wait();

      const count = await userPosts.getPostCount();
      postIndices.push(Number(count) - 1);
    } catch (err) {
      console.log(`   [ERROR] Post: ${err.message}`);
      postIndices.push(-1);
    }
  }

  console.log(`   [OK] ${postIndices.filter((i) => i >= 0).length} posts created`);

  // ========== 7. ADD REPLIES TO THREADS ==========
  console.log("\n" + "-".repeat(40));
  console.log("7. Adding replies to forum threads...");
  console.log("-".repeat(40));

  const forumThreadAddress = addresses.forumThread;
  let threadReplyCount = 0;

  for (const [threadIndexStr, replyList] of Object.entries(THREAD_REPLIES)) {
    const threadIndex = parseInt(threadIndexStr);
    const actualIndex = threadIndices[threadIndex];

    if (actualIndex < 0) continue;

    for (const replyData of replyList) {
      try {
        const tx = await replies
          .connect(users[replyData.user])
          .addReply(forumThreadAddress, ENTITY_TYPES.FORUM_THREAD, actualIndex, replyData.content, 0);
        await tx.wait();
        threadReplyCount++;
      } catch (err) {
        console.log(`   [ERROR] Thread reply: ${err.message}`);
      }
    }
  }

  console.log(`   [OK] ${threadReplyCount} thread replies added`);

  // ========== 8. ADD REPLIES TO POSTS ==========
  console.log("\n" + "-".repeat(40));
  console.log("8. Adding replies to user posts...");
  console.log("-".repeat(40));

  const userPostsAddress = addresses.userPosts;
  let postReplyCount = 0;

  for (const [postIndexStr, replyList] of Object.entries(POST_REPLIES)) {
    const postIndex = parseInt(postIndexStr);
    const actualIndex = postIndices[postIndex];

    if (actualIndex < 0) continue;

    for (const replyData of replyList) {
      try {
        const tx = await replies
          .connect(users[replyData.user])
          .addReply(userPostsAddress, ENTITY_TYPES.USER_POST, actualIndex, replyData.content, 0);
        await tx.wait();
        postReplyCount++;
      } catch (err) {
        console.log(`   [ERROR] Post reply: ${err.message}`);
      }
    }
  }

  console.log(`   [OK] ${postReplyCount} post replies added`);

  // ========== 9. ADD VOTES TO POSTS ==========
  console.log("\n" + "-".repeat(40));
  console.log("9. Adding votes to user posts...");
  console.log("-".repeat(40));

  let postVoteCount = 0;

  for (const voteData of POST_VOTES) {
    const actualIndex = postIndices[voteData.postIndex];
    if (actualIndex < 0) continue;

    const entityId = await voting.getEntityId(userPostsAddress, ENTITY_TYPES.USER_POST, actualIndex);

    for (const vote of voteData.votes) {
      try {
        const tx = await voting.connect(users[vote.user]).vote(entityId, vote.type);
        await tx.wait();
        postVoteCount++;
      } catch (err) {
        // Vote might already exist
      }
    }
  }

  console.log(`   [OK] ${postVoteCount} post votes added`);

  // ========== 10. ADD VOTES TO THREADS ==========
  console.log("\n" + "-".repeat(40));
  console.log("10. Adding votes to forum threads...");
  console.log("-".repeat(40));

  let threadVoteCount = 0;

  for (const voteData of THREAD_VOTES) {
    const actualIndex = threadIndices[voteData.threadIndex];
    if (actualIndex < 0) continue;

    const entityId = await voting.getEntityId(forumThreadAddress, ENTITY_TYPES.FORUM_THREAD, actualIndex);

    for (const vote of voteData.votes) {
      try {
        const tx = await voting.connect(users[vote.user]).vote(entityId, vote.type);
        await tx.wait();
        threadVoteCount++;
      } catch (err) {
        // Vote might already exist
      }
    }
  }

  console.log(`   [OK] ${threadVoteCount} thread votes added`);

  // ========== SUMMARY ==========
  console.log("\n" + "=".repeat(60));
  console.log("TEST DATA SEEDING COMPLETE!");
  console.log("=".repeat(60));
  console.log(`
Summary:
  - ${TEST_USERS.length} user profiles created
  - ${FOLLOWING.reduce((a, r) => a + r.follows.length, 0)} follow relationships
  - ${Object.keys(channelAddresses).length} chat channels
  - ${Object.values(CHANNEL_MESSAGES).reduce((a, m) => a + m.length, 0)} channel messages
  - ${FORUM_THREADS.length} forum threads
  - ${USER_POSTS.length} user posts
  - ${threadReplyCount + postReplyCount} replies
  - ${postVoteCount + threadVoteCount} votes
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
