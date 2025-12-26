import hre from "hardhat";

const OLD_REGISTRY = "0x66ad45c21deDF0F6dd18A3D3d6E811f087341f57";
const NEW_REGISTRY = "0x8975edD114210449a69A102994F890BA2B28031A";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Migrating channels from old registry to new registry");
  console.log("Account:", deployer.address);
  console.log("Old Registry:", OLD_REGISTRY);
  console.log("New Registry:", NEW_REGISTRY);
  console.log("");

  // Get contract instances
  const ChannelRegistry = await hre.ethers.getContractFactory("ChannelRegistry");
  const oldRegistry = ChannelRegistry.attach(OLD_REGISTRY);
  const newRegistry = ChannelRegistry.attach(NEW_REGISTRY);

  // Get all channels from old registry
  console.log("Fetching channels from old registry...");
  const oldChannels = await oldRegistry.getAllChannels();
  console.log(`Found ${oldChannels.length} channels in old registry\n`);

  if (oldChannels.length === 0) {
    console.log("No channels to migrate.");
    return;
  }

  // Check which channels are already registered in new registry
  const channelsToMigrate = [];
  for (const channel of oldChannels) {
    const isRegistered = await newRegistry.isRegistered(channel.channelAddress);
    if (!isRegistered) {
      channelsToMigrate.push(channel);
    } else {
      console.log(`  ⏭️  ${channel.channelAddress} - already registered, skipping`);
    }
  }

  console.log(`\n${channelsToMigrate.length} channels to migrate\n`);

  if (channelsToMigrate.length === 0) {
    console.log("All channels already migrated!");
    return;
  }

  // Migrate each channel
  for (let i = 0; i < channelsToMigrate.length; i++) {
    const channel = channelsToMigrate[i];
    console.log(`[${i + 1}/${channelsToMigrate.length}] Registering ${channel.channelAddress}...`);

    try {
      const tx = await newRegistry.registerChannel(channel.channelAddress);
      await tx.wait();
      console.log(`  ✅ Registered successfully`);
    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);
    }
  }

  // Verify migration
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION COMPLETE");
  console.log("=".repeat(60));

  const newChannels = await newRegistry.getAllChannels();
  console.log(`\nNew registry now has ${newChannels.length} channels:`);
  for (const channel of newChannels) {
    // Get channel name
    try {
      const ChatChannel = await hre.ethers.getContractFactory("ChatChannel");
      const chatChannel = ChatChannel.attach(channel.channelAddress);
      const name = await chatChannel.name();
      console.log(`  #${name} - ${channel.channelAddress}`);
    } catch {
      console.log(`  ${channel.channelAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
