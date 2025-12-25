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
  console.log("\n1/3 Deploying UserRegistry...");
  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log(`   ✅ UserRegistry deployed to: ${userRegistryAddress}`);

  // 2. Deploy ChannelRegistry
  console.log("\n2/3 Deploying ChannelRegistry...");
  const ChannelRegistry = await hre.ethers.getContractFactory("ChannelRegistry");
  const channelRegistry = await ChannelRegistry.deploy(userRegistryAddress);
  await channelRegistry.waitForDeployment();
  const channelRegistryAddress = await channelRegistry.getAddress();
  console.log(`   ✅ ChannelRegistry deployed to: ${channelRegistryAddress}`);

  // 3. Create default #general channel
  console.log("\n3/3 Creating #general channel...");
  const tx = await channelRegistry.createChannel(
    "general",
    "General discussion",
    0 // Open posting mode
  );
  const receipt = await tx.wait();

  // Get the created channel address
  const channelInfo = await channelRegistry.getChannel(0);
  console.log(`   ✅ #general channel created at: ${channelInfo.channelAddress}`);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nContract Addresses:");
  console.log(`  UserRegistry:    ${userRegistryAddress}`);
  console.log(`  ChannelRegistry: ${channelRegistryAddress}`);
  console.log(`  #general:        ${channelInfo.channelAddress}`);
  console.log("\nOpen the chat at:");
  console.log(`  http://localhost:5173/?registry=${channelRegistryAddress}`);
  console.log("\nOr directly access #general:");
  console.log(`  http://localhost:5173/?channel=${channelInfo.channelAddress}`);

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
    channels: {
      general: channelInfo.channelAddress,
    },
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
