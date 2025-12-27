import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying ForumThread with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH/PAS");

  if (balance === 0n) {
    console.error("\n❌ ERROR: Your wallet has no funds!");
    console.error("Get testnet tokens from: https://faucet.polkadot.io/?parachain=1111");
    console.error("Your address:", deployer.address);
    process.exit(1);
  }

  // Load existing deployments to get userRegistry address
  const deploymentsPath = path.join(__dirname, "../../deployments.json");
  let deployments = {};

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

  // Get userRegistry address
  if (!deployments[networkName] || !deployments[networkName].userRegistry) {
    console.error(`❌ ERROR: userRegistry not found for network ${networkName}`);
    console.error("Please deploy UserRegistry first using the main deploy script.");
    process.exit(1);
  }

  const userRegistryAddress = deployments[networkName].userRegistry;
  console.log(`\nUsing UserRegistry at: ${userRegistryAddress}`);

  // Deploy ForumThread with UserRegistry address
  console.log("Deploying ForumThread...");
  const ForumThread = await hre.ethers.getContractFactory("ForumThread");
  const forumThread = await ForumThread.deploy(userRegistryAddress);
  await forumThread.waitForDeployment();
  const forumThreadAddress = await forumThread.getAddress();
  console.log(`✅ ForumThread deployed to: ${forumThreadAddress}`);

  // Add forumThread to existing deployment
  if (deployments[networkName]) {
    deployments[networkName].forumThread = forumThreadAddress;
    deployments[networkName].deployedAt = new Date().toISOString();
  } else {
    console.error(`Network ${networkName} not found in deployments.json`);
    process.exit(1);
  }

  // Save deployments
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n✅ Updated deployments.json with forumThread address`);

  // Remind to copy to frontend
  console.log(`\nNext steps:`);
  console.log(`1. Copy deployments.json to frontend/public/`);
  console.log(`   cp deployments.json ../frontend/public/`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
