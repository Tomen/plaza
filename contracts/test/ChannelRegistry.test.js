import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("ChannelRegistry", function () {
  let userRegistry;
  let channelRegistry;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy UserRegistry
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy();

    // Create profiles
    await userRegistry.createProfile("Owner", "Registry owner");
    await userRegistry.connect(addr1).createProfile("Alice", "User 1");

    // Deploy ChannelRegistry
    const ChannelRegistry = await ethers.getContractFactory("ChannelRegistry");
    channelRegistry = await ChannelRegistry.deploy(await userRegistry.getAddress());
  });

  describe("Deployment", function () {
    it("Should set correct user registry", async function () {
      expect(await channelRegistry.userRegistry()).to.equal(await userRegistry.getAddress());
    });

    it("Should reject invalid registry address", async function () {
      const ChannelRegistry = await ethers.getContractFactory("ChannelRegistry");
      await expect(
        ChannelRegistry.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid registry address");
    });

    it("Should start with zero channels", async function () {
      expect(await channelRegistry.getChannelCount()).to.equal(0);
    });
  });

  describe("Channel Creation", function () {
    it("Should create a channel and register it", async function () {
      const tx = await channelRegistry.createChannel("general", "General chat", 0);
      const receipt = await tx.wait();

      expect(await channelRegistry.getChannelCount()).to.equal(1);

      const channelInfo = await channelRegistry.getChannel(0);
      expect(channelInfo.registeredBy).to.equal(owner.address);
      expect(channelInfo.channelAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should emit ChannelCreated and ChannelRegistered events", async function () {
      await expect(channelRegistry.createChannel("general", "General chat", 0))
        .to.emit(channelRegistry, "ChannelCreated")
        .and.to.emit(channelRegistry, "ChannelRegistered");
    });

    it("Should transfer ownership to creator", async function () {
      await channelRegistry.createChannel("general", "General chat", 0);

      const channelInfo = await channelRegistry.getChannel(0);
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      const channel = ChatChannel.attach(channelInfo.channelAddress);

      expect(await channel.owner()).to.equal(owner.address);
    });

    it("Should create channel with correct parameters", async function () {
      await channelRegistry.createChannel("test-channel", "Test description", 1);

      const channelInfo = await channelRegistry.getChannel(0);
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      const channel = ChatChannel.attach(channelInfo.channelAddress);

      expect(await channel.name()).to.equal("test-channel");
      expect(await channel.description()).to.equal("Test description");
      expect(await channel.postingMode()).to.equal(1);
    });

    it("Should create multiple channels", async function () {
      await channelRegistry.createChannel("general", "General chat", 0);
      await channelRegistry.connect(addr1).createChannel("random", "Random stuff", 0);

      expect(await channelRegistry.getChannelCount()).to.equal(2);
    });
  });

  describe("Channel Registration", function () {
    let standaloneChannel;

    beforeEach(async function () {
      // Deploy a standalone channel
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      standaloneChannel = await ChatChannel.deploy(
        await userRegistry.getAddress(),
        "standalone",
        "Standalone channel",
        0
      );
    });

    it("Should register an existing channel", async function () {
      const channelAddress = await standaloneChannel.getAddress();

      await expect(channelRegistry.registerChannel(channelAddress))
        .to.emit(channelRegistry, "ChannelRegistered")
        .withArgs(channelAddress, owner.address, 0);

      expect(await channelRegistry.getChannelCount()).to.equal(1);
      expect(await channelRegistry.isRegistered(channelAddress)).to.be.true;
    });

    it("Should reject registering zero address", async function () {
      await expect(channelRegistry.registerChannel(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid address");
    });

    it("Should reject duplicate registration", async function () {
      const channelAddress = await standaloneChannel.getAddress();
      await channelRegistry.registerChannel(channelAddress);

      await expect(channelRegistry.registerChannel(channelAddress))
        .to.be.revertedWith("Already registered");
    });

    it("Should track registration by different users", async function () {
      const channelAddress = await standaloneChannel.getAddress();
      await channelRegistry.connect(addr1).registerChannel(channelAddress);

      const channelInfo = await channelRegistry.getChannel(0);
      expect(channelInfo.registeredBy).to.equal(addr1.address);
    });
  });

  describe("Query Functions", function () {
    beforeEach(async function () {
      await channelRegistry.createChannel("general", "General chat", 0);
      await channelRegistry.createChannel("random", "Random stuff", 0);
      await channelRegistry.connect(addr1).createChannel("alice-channel", "Alice's channel", 0);
    });

    it("Should get channel count", async function () {
      expect(await channelRegistry.getChannelCount()).to.equal(3);
    });

    it("Should get channel by index", async function () {
      const channelInfo = await channelRegistry.getChannel(1);
      expect(channelInfo.registeredBy).to.equal(owner.address);

      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      const channel = ChatChannel.attach(channelInfo.channelAddress);
      expect(await channel.name()).to.equal("random");
    });

    it("Should reject out of bounds index", async function () {
      await expect(channelRegistry.getChannel(10))
        .to.be.revertedWith("Index out of bounds");
    });

    it("Should get channels by creator", async function () {
      const ownerChannels = await channelRegistry.getChannelsByCreator(owner.address);
      expect(ownerChannels.length).to.equal(2);
      expect(ownerChannels[0]).to.equal(0n);
      expect(ownerChannels[1]).to.equal(1n);

      const aliceChannels = await channelRegistry.getChannelsByCreator(addr1.address);
      expect(aliceChannels.length).to.equal(1);
      expect(aliceChannels[0]).to.equal(2n);
    });

    it("Should get channels in range", async function () {
      const channels = await channelRegistry.getChannels(0, 2);
      expect(channels.length).to.equal(2);
    });

    it("Should handle range beyond total", async function () {
      const channels = await channelRegistry.getChannels(1, 10);
      expect(channels.length).to.equal(2); // Only 2 remaining from index 1
    });

    it("Should return empty for start beyond total", async function () {
      const channels = await channelRegistry.getChannels(10, 5);
      expect(channels.length).to.equal(0);
    });

    it("Should get all channels", async function () {
      const allChannels = await channelRegistry.getAllChannels();
      expect(allChannels.length).to.equal(3);
    });
  });

  describe("Integration", function () {
    it("Should allow posting to created channel", async function () {
      await channelRegistry.createChannel("general", "General chat", 0);

      const channelInfo = await channelRegistry.getChannel(0);
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      const channel = ChatChannel.attach(channelInfo.channelAddress);

      await channel.postMessage("Hello from registry-created channel!");

      const message = await channel.getMessage(0);
      expect(message.content).to.equal("Hello from registry-created channel!");
    });

    it("Should allow channel management by creator", async function () {
      await channelRegistry.createChannel("general", "General chat", 0);

      const channelInfo = await channelRegistry.getChannel(0);
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      const channel = ChatChannel.attach(channelInfo.channelAddress);

      // Owner should be able to manage
      await channel.setName("new-general");
      await channel.promoteAdmin(addr1.address);

      expect(await channel.name()).to.equal("new-general");
      expect(await channel.isAdmin(addr1.address)).to.be.true;
    });
  });
});
