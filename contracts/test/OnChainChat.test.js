import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("OnChainChat", function () {
  let onChainChat;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const OnChainChat = await ethers.getContractFactory("OnChainChat");
    onChainChat = await OnChainChat.deploy();
  });

  describe("Posting Messages", function () {
    it("Should post a message successfully", async function () {
      const content = "Hello, blockchain!";
      const tx = await onChainChat.postMessage(content);
      const receipt = await tx.wait();

      expect(receipt.logs.length).to.be.greaterThan(0);

      const count = await onChainChat.getMessageCount();
      expect(count).to.equal(1);

      const message = await onChainChat.getMessage(0);
      expect(message.sender).to.equal(owner.address);
      expect(message.content).to.equal(content);
      expect(message.timestamp).to.be.gt(0);
    });

    it("Should reject empty messages", async function () {
      await expect(onChainChat.postMessage(""))
        .to.be.revertedWith("Message cannot be empty");
    });

    it("Should reject messages that are too long", async function () {
      const longMessage = "a".repeat(501);
      await expect(onChainChat.postMessage(longMessage))
        .to.be.revertedWith("Message too long");
    });

    it("Should increment message count correctly", async function () {
      await onChainChat.postMessage("Message 1");
      await onChainChat.postMessage("Message 2");
      await onChainChat.postMessage("Message 3");

      const count = await onChainChat.getMessageCount();
      expect(count).to.equal(3);
    });

    it("Should store sender address correctly", async function () {
      await onChainChat.connect(addr1).postMessage("From addr1");
      const message = await onChainChat.getMessage(0);
      expect(message.sender).to.equal(addr1.address);
    });

    it("Should return correct message index", async function () {
      const index1 = await onChainChat.postMessage.staticCall("Message 1");
      await onChainChat.postMessage("Message 1");

      const index2 = await onChainChat.postMessage.staticCall("Message 2");
      await onChainChat.postMessage("Message 2");

      expect(index1).to.equal(0);
      expect(index2).to.equal(1);
    });
  });

  describe("Reading Messages", function () {
    beforeEach(async function () {
      await onChainChat.connect(owner).postMessage("Message from owner");
      await onChainChat.connect(addr1).postMessage("Message from addr1");
      await onChainChat.connect(addr2).postMessage("Message from addr2");
    });

    it("Should retrieve a specific message", async function () {
      const message = await onChainChat.getMessage(1);
      expect(message.sender).to.equal(addr1.address);
      expect(message.content).to.equal("Message from addr1");
      expect(message.timestamp).to.be.gt(0);
    });

    it("Should reject invalid message index", async function () {
      await expect(onChainChat.getMessage(999))
        .to.be.revertedWith("Message does not exist");
    });

    it("Should return correct message count", async function () {
      const count = await onChainChat.getMessageCount();
      expect(count).to.equal(3);
    });

    it("Should retrieve multiple messages", async function () {
      const messages = await onChainChat.getMessages(0, 2);
      expect(messages.length).to.equal(2);
      expect(messages[0].content).to.equal("Message from owner");
      expect(messages[1].content).to.equal("Message from addr1");
    });

    it("Should handle getMessages with count exceeding array length", async function () {
      const messages = await onChainChat.getMessages(1, 10);
      expect(messages.length).to.equal(2);
    });

    it("Should retrieve latest messages", async function () {
      const messages = await onChainChat.getLatestMessages(2);
      expect(messages.length).to.equal(2);
      expect(messages[0].content).to.equal("Message from addr1");
      expect(messages[1].content).to.equal("Message from addr2");
    });

    it("Should handle getLatestMessages with count exceeding array length", async function () {
      const messages = await onChainChat.getLatestMessages(10);
      expect(messages.length).to.equal(3);
    });

    it("Should return empty array when requesting 0 latest messages", async function () {
      const messages = await onChainChat.getLatestMessages(0);
      expect(messages.length).to.equal(0);
    });
  });

  describe("Message Timestamps", function () {
    it("Should record timestamps for messages", async function () {
      await onChainChat.postMessage("Test message");
      const message = await onChainChat.getMessage(0);
      expect(message.timestamp).to.be.gt(0);
    });

    it("Should have increasing timestamps for consecutive messages", async function () {
      await onChainChat.postMessage("First");
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine");
      await onChainChat.postMessage("Second");

      const msg1 = await onChainChat.getMessage(0);
      const msg2 = await onChainChat.getMessage(1);
      expect(msg2.timestamp).to.be.gte(msg1.timestamp);
    });
  });

  async function getLatestBlockTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }
});
