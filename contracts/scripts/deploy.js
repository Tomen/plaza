import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH/PAS");

  if (balance === 0n) {
    console.error("\n❌ ERROR: Your wallet has no funds!");
    console.error("Get testnet tokens from: https://faucet.polkadot.io/?parachain=1111");
    console.error("Your address:", deployer.address);
    process.exit(1);
  }

  // 1. Deploy UserRegistry
  console.log("\n1/7 Deploying UserRegistry...");
  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log(`   ✅ UserRegistry deployed to: ${userRegistryAddress}`);

  // 2. Deploy ChannelRegistry
  console.log("\n2/7 Deploying ChannelRegistry...");
  const ChannelRegistry = await hre.ethers.getContractFactory("ChannelRegistry");
  const channelRegistry = await ChannelRegistry.deploy(userRegistryAddress);
  await channelRegistry.waitForDeployment();
  const channelRegistryAddress = await channelRegistry.getAddress();
  console.log(`   ✅ ChannelRegistry deployed to: ${channelRegistryAddress}`);

  // 3. Deploy DMRegistry
  console.log("\n3/7 Deploying DMRegistry...");
  const DMRegistry = await hre.ethers.getContractFactory("DMRegistry");
  const dmRegistry = await DMRegistry.deploy(userRegistryAddress);
  await dmRegistry.waitForDeployment();
  const dmRegistryAddress = await dmRegistry.getAddress();
  console.log(`   ✅ DMRegistry deployed to: ${dmRegistryAddress}`);

  // 4. Deploy FollowRegistry
  console.log("\n4/7 Deploying FollowRegistry...");
  const FollowRegistry = await hre.ethers.getContractFactory("FollowRegistry");
  const followRegistry = await FollowRegistry.deploy(userRegistryAddress);
  await followRegistry.waitForDeployment();
  const followRegistryAddress = await followRegistry.getAddress();
  console.log(`   ✅ FollowRegistry deployed to: ${followRegistryAddress}`);

  // 5. Deploy Voting (shared voting system)
  console.log("\n5/7 Deploying Voting...");
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(userRegistryAddress);
  await voting.waitForDeployment();
  const votingAddress = await voting.getAddress();
  console.log(`   ✅ Voting deployed to: ${votingAddress}`);

  // 6. Deploy Replies (shared reply system)
  console.log("\n6/7 Deploying Replies...");
  const Replies = await hre.ethers.getContractFactory("Replies");
  const replies = await Replies.deploy(userRegistryAddress);
  await replies.waitForDeployment();
  const repliesAddress = await replies.getAddress();
  console.log(`   ✅ Replies deployed to: ${repliesAddress}`);

  // 7. Deploy UserPosts (profile posts)
  console.log("\n7/7 Deploying UserPosts...");
  const UserPosts = await hre.ethers.getContractFactory("UserPosts");
  const userPosts = await UserPosts.deploy(userRegistryAddress);
  await userPosts.waitForDeployment();
  const userPostsAddress = await userPosts.getAddress();
  console.log(`   ✅ UserPosts deployed to: ${userPostsAddress}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log(`  UserRegistry:    ${userRegistryAddress}`);
  console.log(`  ChannelRegistry: ${channelRegistryAddress}`);
  console.log(`  DMRegistry:      ${dmRegistryAddress}`);
  console.log(`  FollowRegistry:  ${followRegistryAddress}`);
  console.log(`  Voting:          ${votingAddress}`);
  console.log(`  Replies:         ${repliesAddress}`);
  console.log(`  UserPosts:       ${userPostsAddress}`);
  console.log("\nOpen the chat at:");
  console.log(`  http://localhost:5173/?registry=${channelRegistryAddress}`);
  console.log("\nNote: Create channels via the UI or register existing ones with migrate-channels.js");

  // Save deployment info to deployments.json
  console.log("\n" + "=".repeat(60));
  console.log("SAVING DEPLOYMENT INFO");
  console.log("=".repeat(60));

  const deploymentsPath = path.join(__dirname, "../../deployments.json");
  let deployments = {};

  // Load existing deployments
  if (fs.existsSync(deploymentsPath)) {
    const content = fs.readFileSync(deploymentsPath, "utf8");
    deployments = JSON.parse(content);
  }

  // Determine network name
  const network = hre.network;
  const networkName =
    network.name === "polkadotAssetHub"
      ? "polkadot-asset-hub-testnet"
      : network.name === "hardhat"
      ? "local-hardhat"
      : network.name;

  // Get network config
  const networkConfig = network.config;
  const chainId = networkConfig.chainId || 0;
  const rpcUrl = networkConfig.url || "http://127.0.0.1:8545";

  // Get friendly network name
  let friendlyName = "Local Network";
  if (network.name === "polkadotAssetHub") {
    friendlyName = "Polkadot Asset Hub Testnet";
  } else if (network.name === "hardhat") {
    friendlyName = "Local Hardhat Network";
  }

  // Create deployment record
  deployments[networkName] = {
    network: friendlyName,
    chainId: chainId,
    rpcUrl: rpcUrl,
    userRegistry: userRegistryAddress,
    channelRegistry: channelRegistryAddress,
    dmRegistry: dmRegistryAddress,
    followRegistry: followRegistryAddress,
    voting: votingAddress,
    replies: repliesAddress,
    userPosts: userPostsAddress,
    deployedAt: new Date().toISOString(),
  };

  // Save deployments
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n✅ Deployment info saved to: deployments.json`);
  console.log(`   Network: ${networkName}`);
  console.log(`   Chain ID: ${chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
