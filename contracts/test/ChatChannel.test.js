import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("ChatChannel", function () {
  let userRegistry;
  let chatChannel;
  let owner;
  let addr1;
  let addr2;
  let delegate;

  beforeEach(async function () {
    [owner, addr1, addr2, delegate] = await ethers.getSigners();

    // Deploy UserRegistry
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy();

    // Create profiles
    await userRegistry.createProfile("Owner", "Channel owner");
    await userRegistry.connect(addr1).createProfile("Alice", "User 1");
    await userRegistry.connect(addr2).createProfile("Bob", "User 2");

    // Deploy ChatChannel
    const ChatChannel = await ethers.getContractFactory("ChatChannel");
    chatChannel = await ChatChannel.deploy(
      await userRegistry.getAddress(),
      "general",
      "General chat",
      0 // Open posting mode
    );
  });

  describe("Deployment", function () {
    it("Should set correct initial values", async function () {
      expect(await chatChannel.name()).to.equal("general");
      expect(await chatChannel.description()).to.equal("General chat");
      expect(await chatChannel.owner()).to.equal(owner.address);
      expect(await chatChannel.postingMode()).to.equal(0); // Open
    });

    it("Should reject invalid registry address", async function () {
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      await expect(
        ChatChannel.deploy(ethers.ZeroAddress, "test", "desc", 0)
      ).to.be.revertedWith("Invalid registry address");
    });

    it("Should reject empty name", async function () {
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      await expect(
        ChatChannel.deploy(await userRegistry.getAddress(), "", "desc", 0)
      ).to.be.revertedWith("Name required");
    });
  });

  describe("Messaging - Open Mode", function () {
    it("Should post a message successfully", async function () {
      const tx = await chatChannel.postMessage("Hello world");
      const receipt = await tx.wait();

      expect(await chatChannel.getMessageCount()).to.equal(1);

      const message = await chatChannel.getMessage(0);
      expect(message.profileOwner).to.equal(owner.address);
      expect(message.sender).to.equal(owner.address);
      expect(message.content).to.equal("Hello world");
    });

    it("Should emit MessagePosted event", async function () {
      await expect(chatChannel.postMessage("Hello"))
        .to.emit(chatChannel, "MessagePosted");
    });

    it("Should allow any profile to post in open mode", async function () {
      await chatChannel.connect(addr1).postMessage("From Alice");
      await chatChannel.connect(addr2).postMessage("From Bob");

      expect(await chatChannel.getMessageCount()).to.equal(2);
    });

    it("Should reject empty messages", async function () {
      await expect(chatChannel.postMessage(""))
        .to.be.revertedWith("Message cannot be empty");
    });

    it("Should reject messages too long", async function () {
      const longMessage = "a".repeat(1001);
      await expect(chatChannel.postMessage(longMessage))
        .to.be.revertedWith("Message too long");
    });

    it("Should allow posting without profile", async function () {
      const [, , , , noProfile] = await ethers.getSigners();
      await chatChannel.connect(noProfile).postMessage("Hello from anon");

      const message = await chatChannel.getMessage(0);
      expect(message.profileOwner).to.equal(noProfile.address);
      expect(message.sender).to.equal(noProfile.address);
      expect(message.content).to.equal("Hello from anon");
    });

    it("Should use sender address as profileOwner when no profile", async function () {
      const [, , , , noProfile] = await ethers.getSigners();
      await chatChannel.connect(noProfile).postMessage("Anonymous message");

      const message = await chatChannel.getMessage(0);
      // Without a profile, profileOwner should equal sender
      expect(message.profileOwner).to.equal(noProfile.address);
      expect(message.sender).to.equal(noProfile.address);
    });
  });

  describe("Messaging - With Delegate", function () {
    beforeEach(async function () {
      // Owner adds delegate
      await userRegistry.addDelegate(delegate.address);
    });

    it("Should allow delegate to post on behalf of owner", async function () {
      await chatChannel.connect(delegate).postMessage("Delegated message");

      const message = await chatChannel.getMessage(0);
      expect(message.profileOwner).to.equal(owner.address);
      expect(message.sender).to.equal(delegate.address);
    });

    it("Should resolve delegate correctly", async function () {
      await chatChannel.connect(delegate).postMessage("Test");

      const message = await chatChannel.getMessage(0);
      expect(message.profileOwner).to.equal(owner.address);
    });
  });

  describe("Messaging - Permissioned Mode", function () {
    let permissionedChannel;

    beforeEach(async function () {
      const ChatChannel = await ethers.getContractFactory("ChatChannel");
      permissionedChannel = await ChatChannel.deploy(
        await userRegistry.getAddress(),
        "private",
        "Private chat",
        1 // Permissioned mode
      );
    });

    it("Should allow owner to post", async function () {
      await permissionedChannel.postMessage("Owner message");
      expect(await permissionedChannel.getMessageCount()).to.equal(1);
    });

    it("Should block non-allowed posters", async function () {
      await expect(permissionedChannel.connect(addr1).postMessage("Blocked"))
        .to.be.revertedWith("Not allowed to post");
    });

    it("Should allow added poster to post", async function () {
      await permissionedChannel.addAllowedPoster(addr1.address);
      await permissionedChannel.connect(addr1).postMessage("Allowed");
      expect(await permissionedChannel.getMessageCount()).to.equal(1);
    });

    it("Should allow admin to post", async function () {
      await permissionedChannel.promoteAdmin(addr1.address);
      await permissionedChannel.connect(addr1).postMessage("Admin message");
      expect(await permissionedChannel.getMessageCount()).to.equal(1);
    });
  });

  describe("Message Retrieval", function () {
    beforeEach(async function () {
      await chatChannel.postMessage("Message 1");
      await chatChannel.postMessage("Message 2");
      await chatChannel.postMessage("Message 3");
    });

    it("Should get messages in range", async function () {
      const messages = await chatChannel.getMessages(0, 2);
      expect(messages.length).to.equal(2);
      expect(messages[0].content).to.equal("Message 1");
      expect(messages[1].content).to.equal("Message 2");
    });

    it("Should get latest messages", async function () {
      const messages = await chatChannel.getLatestMessages(2);
      expect(messages.length).to.equal(2);
      expect(messages[0].content).to.equal("Message 2");
      expect(messages[1].content).to.equal("Message 3");
    });

    it("Should handle out of range gracefully", async function () {
      const messages = await chatChannel.getMessages(10, 5);
      expect(messages.length).to.equal(0);
    });
  });

  describe("Metadata Management", function () {
    it("Should update name", async function () {
      await expect(chatChannel.setName("new-name"))
        .to.emit(chatChannel, "NameUpdated")
        .withArgs("new-name");
      expect(await chatChannel.name()).to.equal("new-name");
    });

    it("Should update description", async function () {
      await expect(chatChannel.setDescription("New description"))
        .to.emit(chatChannel, "DescriptionUpdated")
        .withArgs("New description");
      expect(await chatChannel.description()).to.equal("New description");
    });

    it("Should update MOTD", async function () {
      await expect(chatChannel.setMessageOfTheDay("Welcome!"))
        .to.emit(chatChannel, "MessageOfTheDayUpdated")
        .withArgs("Welcome!");
      expect(await chatChannel.messageOfTheDay()).to.equal("Welcome!");
    });

    it("Should reject non-owner/admin updates", async function () {
      await expect(chatChannel.connect(addr1).setName("hacked"))
        .to.be.revertedWith("Not owner or admin");
    });
  });

  describe("Admin Management", function () {
    it("Should promote admin", async function () {
      await expect(chatChannel.promoteAdmin(addr1.address))
        .to.emit(chatChannel, "AdminPromoted")
        .withArgs(addr1.address, owner.address);
      expect(await chatChannel.isAdmin(addr1.address)).to.be.true;
    });

    it("Should demote admin (only owner)", async function () {
      await chatChannel.promoteAdmin(addr1.address);

      await expect(chatChannel.demoteAdmin(addr1.address))
        .to.emit(chatChannel, "AdminDemoted")
        .withArgs(addr1.address, owner.address);
      expect(await chatChannel.isAdmin(addr1.address)).to.be.false;
    });

    it("Should reject non-owner demoting", async function () {
      await chatChannel.promoteAdmin(addr1.address);
      await chatChannel.promoteAdmin(addr2.address);

      await expect(chatChannel.connect(addr1).demoteAdmin(addr2.address))
        .to.be.revertedWith("Not owner");
    });
  });

  describe("Ownership Transfer", function () {
    it("Should transfer ownership", async function () {
      await expect(chatChannel.transferOwnership(addr1.address))
        .to.emit(chatChannel, "OwnershipTransferred")
        .withArgs(owner.address, addr1.address);
      expect(await chatChannel.owner()).to.equal(addr1.address);
    });

    it("Should reject transfer to zero address", async function () {
      await expect(chatChannel.transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid address");
    });

    it("Should reject transfer from non-owner", async function () {
      await expect(chatChannel.connect(addr1).transferOwnership(addr2.address))
        .to.be.revertedWith("Not owner");
    });
  });

  describe("Posting Mode", function () {
    it("Should change posting mode", async function () {
      await expect(chatChannel.setPostingMode(1))
        .to.emit(chatChannel, "PostingModeChanged")
        .withArgs(1, owner.address);
      expect(await chatChannel.postingMode()).to.equal(1);
    });
  });

  describe("Channel Info", function () {
    it("Should return correct channel info", async function () {
      await chatChannel.postMessage("Test");
      await chatChannel.setMessageOfTheDay("Welcome!");

      const info = await chatChannel.getChannelInfo();
      expect(info._name).to.equal("general");
      expect(info._description).to.equal("General chat");
      expect(info._motd).to.equal("Welcome!");
      expect(info._owner).to.equal(owner.address);
      expect(info._postingMode).to.equal(0);
      expect(info._messageCount).to.equal(1);
    });
  });
});
